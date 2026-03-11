import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import type { BridgeSdkClientConfig, OpencodeSdkLike } from "./bridge-sdk-client.ts"

interface TextPromptPart {
  type: "text"
  text: string
}

function isTextPromptPart(value: unknown): value is TextPromptPart {
  return typeof value === "object"
    && value !== null
    && (value as { type?: unknown }).type === "text"
    && typeof (value as { text?: unknown }).text === "string"
}

function toPromptParts(parts: Array<unknown>): TextPromptPart[] {
  return parts.map((part) => {
    if (!isTextPromptPart(part)) {
      throw new Error("Only text prompt parts are supported by omo-claw right now")
    }
    return part
  })
}

async function requireData<T>(
  operation: Promise<{ data?: T; request?: unknown; error?: unknown }>,
  message: string,
): Promise<{ data: T; request?: unknown }> {
  const result = await operation
  if (result.data === undefined) {
    const suffix = result.error instanceof Error
      ? ` ${result.error.message}`
      : ""
    throw new Error(`${message}.${suffix}`)
  }
  return {
    data: result.data,
    request: result.request,
  }
}

async function passthroughData<T>(
  operation: Promise<{ data?: T; request?: unknown; error?: unknown }>,
): Promise<{ data: T | undefined; request?: unknown }> {
  const result = await operation
  return {
    data: result.data,
    request: result.request,
  }
}

export function createOpencodeSdkAdapter(config: BridgeSdkClientConfig): OpencodeSdkLike {
  const client = createOpencodeClient({
    baseUrl: config.baseUrl,
    directory: config.directory,
    headers: config.headers,
    throwOnError: true,
  })

  return {
    global: {
      health: () => requireData(client.global.health(), "OpenCode health response is missing data"),
      event: () => client.global.event(),
    },
    session: {
      create: (parameters) => requireData(client.session.create(parameters), "OpenCode session.create response is missing data"),
      get: (parameters) => requireData(client.session.get(parameters), "OpenCode session.get response is missing data"),
      messages: (parameters) => requireData(client.session.messages(parameters), "OpenCode session.messages response is missing data"),
      promptAsync: (parameters) => passthroughData(client.session.promptAsync({
        ...parameters,
        parts: toPromptParts(parameters.parts),
      })),
      command: (parameters) => passthroughData(client.session.command(parameters)),
      todo: (parameters) => passthroughData(client.session.todo(parameters)),
      respondPermission: (parameters) => requireData(client.permission.respond(parameters), "OpenCode permission.respond response is missing data"),
    },
    permission: {
      reply: (parameters) => requireData(client.permission.reply(parameters), "OpenCode permission.reply response is missing data"),
    },
  }
}
