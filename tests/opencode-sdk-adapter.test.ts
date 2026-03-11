import { describe, expect, test } from "bun:test"
import { normalizePromptPartsForOpencode } from "../src/opencode-sdk-adapter.ts"

describe("normalizePromptPartsForOpencode", () => {
  test("keeps text parts unchanged", () => {
    expect(normalizePromptPartsForOpencode([{ type: "text", text: "hello" }])).toEqual([
      { type: "text", text: "hello" },
    ])
  })

  test("downgrades rich parts into text parts", () => {
    expect(normalizePromptPartsForOpencode([
      { type: "toolResult", content: [{ type: "text", text: "result body" }] },
      { type: "image", url: "file:///tmp/example.png" },
    ])).toEqual([
      { type: "text", text: "result body" },
      { type: "text", text: expect.stringContaining("[image]") },
    ])
  })
})
