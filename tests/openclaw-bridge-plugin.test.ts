import { describe, expect, test } from "bun:test"
import { createOpenClawBridgePlugin, normalizeContextEngineIngest, type OpenClawPluginApi } from "../src/openclaw-bridge-plugin.ts"

function createOrchestratorStub() {
  return {
    async getHealth() {
      return {
        healthy: true,
        version: "1.2.21",
        baseUrl: "http://127.0.0.1:19222",
      }
    },
    async injectContext(_threadID: string, _text: string) {
      return undefined
    },
    getStatus() {
      return {
        runtimeBaseUrl: "http://127.0.0.1:19222",
        threads: [],
        pendingPermissions: [],
      }
    },
  }
}

describe("OpenClaw bridge plugin", () => {
  test("registers gateway method, command, and context engine", async () => {
    const gatewayMethods: string[] = []
    const commands: Array<{ name: string; handler: OpenClawPluginApi["registerCommand"] extends (command: infer T) => void ? T : never }> = []
    const contextEngines: string[] = []

    const api: OpenClawPluginApi = {
      registerGatewayMethod(name) {
        gatewayMethods.push(name)
      },
      registerCommand(command) {
        commands.push({ name: command.name, handler: command })
      },
      registerContextEngine(id) {
        contextEngines.push(id)
      },
    }

    createOpenClawBridgePlugin(createOrchestratorStub() as never)(api)

    expect(gatewayMethods).toEqual(["omo-claw.status"])
    expect(commands.map((item) => item.name)).toEqual(["omo_claw_status"])
    expect(contextEngines).toEqual(["omo-claw"])
    await expect(commands[0].handler.handler({ commandBody: "/omo_claw_status" })).resolves.toEqual({
      text: "bridge=http://127.0.0.1:19222 healthy=true threads=0 pendingPermissions=0",
    })
  })

  test("formats object-style ingest failures into readable errors", async () => {
    let ingest: ((input: { threadID: string; text: string }) => Promise<{ ingested: boolean }>) | undefined

    const api: OpenClawPluginApi = {
      registerGatewayMethod() {},
      registerCommand() {},
      registerContextEngine(_id, factory) {
        ingest = factory().ingest
      },
    }

    createOpenClawBridgePlugin({
      async getHealth() {
        return { healthy: true, version: "1.2.21", baseUrl: "http://127.0.0.1:19222" }
      },
      async injectContext() {
        throw {
          name: "ConfigInvalidError",
          data: {
            path: "integration/bridge-runtime/opencode.bridge.json",
            issues: [{ message: 'Unrecognized keys: "runtime", "bridge", "policy"' }],
          },
        }
      },
      getStatus() {
        return { runtimeBaseUrl: "http://127.0.0.1:19222", threads: [], pendingPermissions: [] }
      },
    } as never)(api)

    await expect(ingest?.({ threadID: "thread-1", text: "hello" })).rejects.toThrow(
      "omo-claw ingest failed: ConfigInvalidError | path=integration/bridge-runtime/opencode.bridge.json | Unrecognized keys: \"runtime\", \"bridge\", \"policy\"",
    )
  })

  test("normalizes rich ingest payloads into thread text", () => {
    expect(normalizeContextEngineIngest({
      sessionId: "session-1",
      message: {
        role: "user",
        content: [
          { type: "text", text: "remember this" },
          { type: "image", url: "file:///tmp/example.png" },
        ],
      },
    })).toEqual({
      threadID: "session-1",
      text: expect.stringContaining("[user] remember this"),
    })
  })
})
