import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const generateContentMock = vi.fn()
const geminiRequestLogCreateMock = vi.fn()

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: generateContentMock,
    },
  })),
}))

vi.mock("./prisma", () => ({
  prisma: {
    geminiRequestLog: {
      create: geminiRequestLogCreateMock,
    },
  },
}))

import { editLogoImage, generateLogoImage } from "./gemini"

const OK_RESPONSE = {
  candidates: [
    {
      content: {
        parts: [
          {
            inlineData: {
              data: Buffer.from("ok").toString("base64"),
              mimeType: "image/png",
            },
          },
        ],
      },
    },
  ],
}

describe("gemini request logging", () => {
  beforeEach(() => {
    generateContentMock.mockReset()
    geminiRequestLogCreateMock.mockReset()
    vi.useFakeTimers()
    process.env.GEMINI_API_KEY = "test-key"
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("writes ok log on successful generate attempt", async () => {
    generateContentMock.mockResolvedValueOnce(OK_RESPONSE)

    await generateLogoImage("make logo")

    expect(geminiRequestLogCreateMock).toHaveBeenCalledTimes(1)
    expect(geminiRequestLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        projectId: null,
        model: "gemini-3-pro-image-preview",
        status: "ok",
        httpCode: null,
        attempt: 1,
        latencyMs: expect.any(Number),
      }),
    })
  })

  it("writes retry then ok logs when retryable error recovers", async () => {
    const retryableError = Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 })
    generateContentMock.mockRejectedValueOnce(retryableError).mockResolvedValueOnce(OK_RESPONSE)

    const request = generateLogoImage("retry me")
    await vi.runAllTimersAsync()
    await request

    expect(geminiRequestLogCreateMock).toHaveBeenCalledTimes(2)
    expect(geminiRequestLogCreateMock).toHaveBeenNthCalledWith(
      1,
      {
        data: expect.objectContaining({
          status: "retry",
          httpCode: 429,
          attempt: 1,
          errorMessage: "RESOURCE_EXHAUSTED",
          latencyMs: expect.any(Number),
        }),
      },
    )
    expect(geminiRequestLogCreateMock).toHaveBeenNthCalledWith(
      2,
      {
        data: expect.objectContaining({
          status: "ok",
          httpCode: null,
          attempt: 2,
          latencyMs: expect.any(Number),
        }),
      },
    )
  })

  it("writes failed log on final edit failure", async () => {
    const failure = Object.assign(new Error("fatal"), { status: 500 })
    generateContentMock.mockRejectedValueOnce(failure)

    await expect(editLogoImage("edit", Buffer.from("src"), "image/png")).rejects.toThrow("fatal")

    expect(geminiRequestLogCreateMock).toHaveBeenCalledTimes(1)
    expect(geminiRequestLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "failed",
        httpCode: 500,
        attempt: 1,
        errorMessage: "fatal",
        latencyMs: expect.any(Number),
      }),
    })
  })
})


describe("editLogoImage reference contents", () => {
  beforeEach(() => {
    generateContentMock.mockReset()
    process.env.GEMINI_API_KEY = "test-key"
  })

  it("builds contents with source, references, instruction, and prompt", async () => {
    generateContentMock.mockResolvedValueOnce(OK_RESPONSE)

    const source = Buffer.from("source-image")
    const ref1 = { data: "cmVmLTE=", mimeType: "image/png" }
    const ref2 = { data: "cmVmLTI=", mimeType: "image/jpeg" }

    await editLogoImage("edit prompt", source, "image/png", [ref1, ref2])

    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [
          { inlineData: { mimeType: "image/png", data: source.toString("base64") } },
          { inlineData: ref1 },
          { inlineData: ref2 },
          "Image 1: source to edit. Images 2..N: reference for style/content.",
          "edit prompt",
        ],
      }),
    )
  })

  it("builds contents with source and prompt when references are absent", async () => {
    generateContentMock.mockResolvedValueOnce(OK_RESPONSE)

    const source = Buffer.from("source-image")

    await editLogoImage("edit prompt", source, "image/png")

    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [
          { inlineData: { mimeType: "image/png", data: source.toString("base64") } },
          "edit prompt",
        ],
      }),
    )
  })
})