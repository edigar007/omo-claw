import { dirname, join } from "node:path"
import { inspect } from "node:util"
import { fileURLToPath } from "node:url"
import { BridgeOrchestrator } from "./bridge-orchestrator.ts"
import { BridgeSdkClient } from "./bridge-sdk-client.ts"
import { CapabilityService } from "./capability-service.ts"
import { ObservabilityHub } from "./observability-hub.ts"
import { createOpencodeSdkAdapter } from "./opencode-sdk-adapter.ts"
import { buildRpcStatus } from "./rpc-status.ts"
import { RuntimeManager } from "./runtime-manager.ts"

export interface OpenClawPluginApi {
  pluginConfig?: Record<string, unknown>
  registerGatewayMethod(name: string, handler: (context: { respond: (ok: boolean, body: unknown) => void; params?: Record<string, unknown> }) => void | Promise<void>): void
  registerCommand(command: {
    name: string
    description: string
    acceptsArgs?: boolean
    requireAuth?: boolean
    handler: (context: { args?: string; commandBody: string; channel?: string }) => { text: string } | Promise<{ text: string }>
  }): void
  registerContextEngine(id: string, factory: () => {
    info: { id: string; name: string; ownsCompaction: boolean }
    ingest: (input: { threadID: string; text: string }) => Promise<{ ingested: boolean }>
    assemble: (input: { messages: Array<unknown> }) => Promise<{ messages: Array<unknown>; estimatedTokens: number }>
    compact: () => Promise<{ ok: boolean; compacted: boolean }>
  }): void
}

type PermissionFlow = "auto-approve" | "prompt-user" | "deny-all"

interface OmoClawPluginConfig {
  serverBaseUrl?: string
  permissionFlow?: PermissionFlow
}

interface ContextEngineMessageLike {
  role?: unknown
  content?: unknown
  text?: unknown
  type?: unknown
}

function isPermissionFlow(value: unknown): value is PermissionFlow {
  return value === "auto-approve" || value === "prompt-user" || value === "deny-all"
}

function resolvePluginConfig(raw: Record<string, unknown> | undefined): Required<OmoClawPluginConfig> {
  const serverBaseUrl = typeof raw?.serverBaseUrl === "string" && raw.serverBaseUrl.trim().length > 0
    ? raw.serverBaseUrl.trim()
    : "http://127.0.0.1:19222"
  const permissionFlow = isPermissionFlow(raw?.permissionFlow)
    ? raw.permissionFlow
    : "prompt-user"

  return {
    serverBaseUrl,
    permissionFlow,
  }
}

function resolvePluginRootDir(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)))
}

function stringifyContextValue(value: unknown): string {
  if (typeof value === "string") {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyContextValue(item))
      .filter((item) => item.length > 0)
      .join("\n")
  }

  if (typeof value === "object" && value !== null) {
    const text = (value as { text?: unknown }).text
    if (typeof text === "string") {
      return text
    }

    const content = (value as { content?: unknown }).content
    if (content !== undefined) {
      const rendered = stringifyContextValue(content)
      if (rendered.length > 0) {
        return rendered
      }
    }

    const type = (value as { type?: unknown }).type
    if (typeof type === "string") {
      return `[${type}] ${inspect(value, { depth: 3, breakLength: 100 })}`
    }
  }

  return inspect(value, { depth: 3, breakLength: 100 })
}

export function normalizeContextEngineIngest(input: {
  threadID?: unknown
  sessionId?: unknown
  sessionID?: unknown
  text?: unknown
  message?: unknown
}): { threadID: string; text: string } {
  const threadID = typeof input.threadID === "string" && input.threadID.length > 0
    ? input.threadID
    : typeof input.sessionId === "string" && input.sessionId.length > 0
      ? input.sessionId
      : typeof input.sessionID === "string" && input.sessionID.length > 0
        ? input.sessionID
        : null

  if (!threadID) {
    throw new Error("Missing thread/session id in context-engine ingest payload")
  }

  const rawMessage = input.message as ContextEngineMessageLike | undefined
  const rolePrefix = typeof rawMessage?.role === "string" && rawMessage.role.length > 0
    ? `[${rawMessage.role}] `
    : ""
  const rawContent = input.text ?? rawMessage?.content ?? rawMessage?.text ?? rawMessage
  const text = `${rolePrefix}${stringifyContextValue(rawContent)}`.trim()

  return { threadID, text }
}

function formatBridgeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error.length > 0) {
    return error
  }

  if (typeof error === "object" && error !== null) {
    const record = error as {
      name?: unknown
      data?: {
        path?: unknown
        message?: unknown
        issues?: Array<{ message?: unknown; path?: unknown }>
      }
    }
    const parts: string[] = []

    if (typeof record.name === "string" && record.name.length > 0) {
      parts.push(record.name)
    }
    if (typeof record.data?.path === "string" && record.data.path.length > 0) {
      parts.push(`path=${record.data.path}`)
    }
    if (typeof record.data?.message === "string" && record.data.message.length > 0) {
      parts.push(record.data.message)
    }
    if (Array.isArray(record.data?.issues) && record.data.issues.length > 0) {
      const issueMessages = record.data.issues
        .map((issue) => typeof issue.message === "string" ? issue.message : null)
        .filter((message): message is string => message !== null && message.length > 0)
      if (issueMessages.length > 0) {
        parts.push(issueMessages.join("; "))
      }
    }

    if (parts.length > 0) {
      return parts.join(" | ")
    }
  }

  return inspect(error, { depth: 5, breakLength: 120 })
}

function createDefaultOrchestrator(config: Required<OmoClawPluginConfig>): BridgeOrchestrator {
  const pluginRoot = resolvePluginRootDir()
  const runtimeDir = join(pluginRoot, "integration", "bridge-runtime")
  const baseUrl = new URL(config.serverBaseUrl)
  const protocol = baseUrl.protocol === "https:" ? "https" : "http"
  const port = baseUrl.port.length > 0
    ? Number(baseUrl.port)
    : protocol === "https"
      ? 443
      : 80

  const runtimeManager = new RuntimeManager({
    rootDir: pluginRoot,
    runtimeDir,
    protocol,
    port,
    hostname: baseUrl.hostname,
    serverPasswordFile: join(runtimeDir, ".bridge-secret"),
    configPath: join(runtimeDir, "opencode.bridge.json"),
    configDir: join(runtimeDir, ".opencode"),
    xdgConfigHome: join(runtimeDir, "xdg", "config"),
    xdgDataHome: join(runtimeDir, "xdg", "data"),
    xdgStateHome: join(runtimeDir, "xdg", "state"),
    manageProcess: false,
  })

  const sdkClient = new BridgeSdkClient({
    runtime: runtimeManager,
    workingDirectory: pluginRoot,
    sdkFactory: createOpencodeSdkAdapter,
  })

  return new BridgeOrchestrator({
    runtimeManager,
    sdkClient,
    capabilities: ["runtime", "browser-automation"],
  })
}

export function createOpenClawBridgePlugin(
  orchestrator: BridgeOrchestrator,
  options?: { permissionFlow?: PermissionFlow },
) {
  const capabilityService = new CapabilityService()
  const observability = new ObservabilityHub()
  const permissionFlow = options?.permissionFlow ?? "prompt-user"

  return function register(api: OpenClawPluginApi) {
    api.registerGatewayMethod("omo-claw.status", async ({ respond }) => {
      observability.record({
        service: "omo-claw.status",
        level: "info",
        message: "gateway status requested",
      })
      const payload = await buildRpcStatus(orchestrator)
      const capability = capabilityService.snapshotAndEvaluate({
        opencodeVersion: payload.runtime.version,
        omoVersion: "3.11.1",
        sdkNamespace: "v2",
        tools: { ids: ["bash"], mcpServers: ["peekaboo", "github", "xiaohongshu"] },
        commands: { list: ["omo_claw_status"], aliases: { "/omo_claw_status": "omo_claw_status" } },
        agents: { configs: [{ slug: "atlas", hidden: false, hasSystemPrompt: true }] },
        events: { supportedSet: ["message.updated", "todo.updated", "permission.asked", "permission.replied"] },
        permissions: { flow: permissionFlow, toolRestrictions: { atlas: ["/tui"] } },
        plugins: { hooks: ["experimental.session.compacting", "shell.env"] },
      })
      respond(true, {
        ...payload,
        capability,
        mode: capabilityService.getMode(),
        logs: observability.list(),
      })
    })

    api.registerCommand({
      name: "omo_claw_status",
      description: "Show omo claw bridge status",
      handler: async () => {
        const health = await orchestrator.getHealth()
        const status = orchestrator.getStatus()
        observability.record({
          service: "omo_claw_status",
          level: "info",
          message: "command status requested",
        })
        return {
          text: `bridge=${health.baseUrl} healthy=${String(health.healthy)} threads=${status.threads.length} pendingPermissions=${status.pendingPermissions.length}`,
        }
      },
    })

    api.registerContextEngine("omo-claw", () => ({
      info: {
        id: "omo-claw",
        name: "omo claw",
        ownsCompaction: false,
      },
      ingest: async (input: { threadID?: unknown; sessionId?: unknown; sessionID?: unknown; text?: unknown; message?: unknown }) => {
        try {
          const normalized = normalizeContextEngineIngest(input)
          if (normalized.text.length === 0) {
            return { ingested: false }
          }
          await orchestrator.injectContext(normalized.threadID, normalized.text)
        } catch (error) {
          throw new Error(`omo-claw ingest failed: ${formatBridgeError(error)}`)
        }
        return { ingested: true }
      },
      assemble: async ({ messages }) => ({
        messages,
        estimatedTokens: 0,
      }),
      compact: async () => ({
        ok: true,
        compacted: false,
      }),
    }))
  }
}

export default function register(api: OpenClawPluginApi) {
  const pluginConfig = resolvePluginConfig(api.pluginConfig)
  return createOpenClawBridgePlugin(
    createDefaultOrchestrator(pluginConfig),
    { permissionFlow: pluginConfig.permissionFlow },
  )(api)
}
