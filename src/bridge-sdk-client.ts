import type { RuntimeManager } from "./runtime-manager.ts"

export interface BridgeSdkClientConfig {
  baseUrl: string
  directory: string
  headers: Record<string, string>
}

export interface PromptAsyncInput {
  sessionID: string
  agent?: string
  model?: {
    providerID: string
    modelID: string
  }
  noReply?: boolean
  parts: Array<unknown>
}

export interface CommandInput {
  sessionID: string
  command: string
  arguments?: string
  agent?: string
  model?: string
}

export interface SessionCreateInput {
  parentID?: string
  title?: string
}

export interface PermissionReplyInput {
  requestID: string
  reply: "once" | "always" | "reject"
  message?: string
}

export interface SessionPermissionReplyInput {
  sessionID: string
  permissionID: string
  response: "once" | "always" | "reject"
}

export interface SessionRecord {
  id: string
  title?: string
  parentID?: string
  directory?: string
}

export interface SessionMessageRecord {
  info: {
    id: string
    role?: string
  }
  parts?: Array<unknown>
}

type RequestEnvelope<T> = Promise<{ data: T; request?: unknown }>

type PromptModel = {
  providerID: string
  modelID: string
}

type SessionCreateRequest = {
  directory: string
  parentID?: string
  title?: string
}

type SessionGetRequest = {
  sessionID: string
  directory: string
}

type SessionMessagesRequest = {
  sessionID: string
  directory: string
  limit?: number
}

type SessionPromptAsyncRequest = {
  sessionID: string
  directory: string
  agent?: string
  model?: PromptModel
  noReply?: boolean
  parts: Array<unknown>
}

type SessionCommandRequest = {
  sessionID: string
  directory: string
  command: string
  arguments?: string
  agent?: string
  model?: string
}

type SessionTodoRequest = {
  sessionID: string
  directory: string
}

type PermissionReplyRequest = {
  requestID: string
  directory: string
  reply: "once" | "always" | "reject"
  message?: string
}

type SessionPermissionReplyRequest = {
  sessionID: string
  permissionID: string
  directory: string
  response: "once" | "always" | "reject"
}

export interface OpencodeSdkLike {
  global: {
    health(): Promise<{ data: { healthy: boolean; version: string } }>
    event(): Promise<{ stream: AsyncIterable<unknown> }>
  }
  session: {
    create(parameters: SessionCreateRequest): RequestEnvelope<SessionRecord>
    get(parameters: SessionGetRequest): RequestEnvelope<SessionRecord>
    messages(parameters: SessionMessagesRequest): RequestEnvelope<SessionMessageRecord[]>
    promptAsync(parameters: SessionPromptAsyncRequest): RequestEnvelope<unknown>
    command(parameters: SessionCommandRequest): RequestEnvelope<unknown>
    todo(parameters: SessionTodoRequest): RequestEnvelope<unknown>
    respondPermission?(parameters: SessionPermissionReplyRequest): RequestEnvelope<boolean>
  }
  permission: {
    reply(parameters: PermissionReplyRequest): RequestEnvelope<boolean>
  }
}

export class BridgeSdkClient {
  private sdk?: OpencodeSdkLike

  constructor(
    private readonly options: {
      runtime: RuntimeManager
      workingDirectory: string
      sdkFactory: (config: BridgeSdkClientConfig) => OpencodeSdkLike
    },
  ) {}

  buildClientConfig(): BridgeSdkClientConfig {
    return {
      baseUrl: this.options.runtime.getBaseUrl(),
      directory: this.options.workingDirectory,
      headers: {
        Authorization: this.options.runtime.getBasicAuthHeader(),
      },
    }
  }

  async health() {
    return this.getSdk().global.health()
  }

  async subscribeEvents() {
    return this.getSdk().global.event()
  }

  async createSession(input: SessionCreateInput) {
    return this.getSdk().session.create({
      directory: this.options.workingDirectory,
      parentID: input.parentID,
      title: input.title,
    })
  }

  async getSession(sessionID: string) {
    return this.getSdk().session.get({
      sessionID,
      directory: this.options.workingDirectory,
    })
  }

  async messages(sessionID: string, limit?: number) {
    return this.getSdk().session.messages({
      sessionID,
      directory: this.options.workingDirectory,
      ...(limit ? { limit } : {}),
    })
  }

  async promptAsync(input: PromptAsyncInput) {
    return this.getSdk().session.promptAsync({
      sessionID: input.sessionID,
      directory: this.options.workingDirectory,
      agent: input.agent,
      model: input.model,
      noReply: input.noReply,
      parts: input.parts,
    })
  }

  async command(input: CommandInput) {
    return this.getSdk().session.command({
      sessionID: input.sessionID,
      directory: this.options.workingDirectory,
      command: input.command,
      arguments: input.arguments,
      agent: input.agent,
      model: input.model,
    })
  }

  async todo(sessionID: string) {
    return this.getSdk().session.todo({
      sessionID,
      directory: this.options.workingDirectory,
    })
  }

  async replyPermission(input: PermissionReplyInput) {
    return this.getSdk().permission.reply({
      requestID: input.requestID,
      directory: this.options.workingDirectory,
      reply: input.reply,
      message: input.message,
    })
  }

  async respondSessionPermission(input: SessionPermissionReplyInput) {
    const respondPermission = this.getSdk().session.respondPermission
    if (!respondPermission) {
      throw new Error("Session-scoped permission response is not available on this SDK client")
    }

    return respondPermission({
      sessionID: input.sessionID,
      permissionID: input.permissionID,
      directory: this.options.workingDirectory,
      response: input.response,
    })
  }

  private getSdk(): OpencodeSdkLike {
    if (!this.sdk) {
      this.sdk = this.options.sdkFactory(this.buildClientConfig())
    }
    return this.sdk
  }
}
