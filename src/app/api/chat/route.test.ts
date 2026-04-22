import { beforeEach, describe, expect, it, vi } from "vitest"
import { blobCost, imageCost } from "../../../lib/pricing"

const mockAuth = vi.fn()
const mockStreamText = vi.fn()
const mockGenerateLogoImage = vi.fn()
const mockUploadImage = vi.fn()

const mockBuildSystemPrompt = vi.fn(() => "system")
const mockValidateMentions = vi.fn()
const mockExtractMentionParts = vi.fn(() => [])
const mockRenderMentionedVersionsForPrompt = vi.fn(() => "")
const prismaMock = {
  project: { findFirst: vi.fn() },
  subscription: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  chatMessage: { create: vi.fn() },
  usageLog: { create: vi.fn() },
  logoVersion: { create: vi.fn() },
  logo: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
  geminiRequestLog: { create: vi.fn() },
}

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/chat/system-prompt", () => ({ buildSystemPrompt: mockBuildSystemPrompt }))
vi.mock("@/lib/chat/vision-utils", () => ({
  limitImagesPerTurn: (messages: unknown[]) => messages,
  reorderPartsTextFirst: (parts: unknown[]) => parts,
}))
vi.mock("@openrouter/ai-sdk-provider", () => ({ createOpenRouter: () => (_model: string) => ({}) }))
vi.mock("@/lib/gemini", () => ({
  generateLogoImage: mockGenerateLogoImage,
  editLogoImage: vi.fn(),
  withGeminiConcurrency: async (fn: () => Promise<unknown>) => fn(),
}))
vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage")
  return {
    ...actual,
    uploadImage: mockUploadImage,
    resizeAndUploadImage: vi.fn(async () => ({
      url: "https://blob/attachment.webp",
      mediaType: "image/webp",
      bytes: 123,
    })),
  }
})
vi.mock("./mentions", () => ({
  MentionValidationError: class MentionValidationError extends Error {
    missingVersionIds: string[]
    constructor(missingVersionIds: string[]) {
      super("mention invalid")
      this.missingVersionIds = missingVersionIds
    }
  },
  extractMentionParts: mockExtractMentionParts,
  validateMentions: mockValidateMentions,
  renderMentionedVersionsForPrompt: mockRenderMentionedVersionsForPrompt,
}))
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai")
  return {
    ...actual,
    streamText: mockStreamText,
    convertToModelMessages: async (messages: unknown[]) => messages,
    consumeStream: vi.fn(),
    stepCountIs: () => () => false,
    tool: <T extends object>(def: T) => def,
  }
})

describe("chat route cost logging", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1", name: "P", _count: { logos: 0 } })
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: "sub-1",
      tier: "free",
      dailyGenerations: 0,
      dailyResetAt: new Date(Date.now() + 86_400_000),
    })
    prismaMock.chatMessage.create.mockResolvedValue({})
    prismaMock.usageLog.create.mockResolvedValue({})
    prismaMock.logoVersion.create.mockResolvedValue({})
    prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) =>
      fn({
        logo: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "logo-1", orderIndex: 0 }),
        },
      })
    )
    mockUploadImage.mockResolvedValue({ url: "https://blob/logo.webp", bytes: 2048 })
  })
    mockBuildSystemPrompt.mockReturnValue("system")
    mockValidateMentions.mockResolvedValue([])
    mockExtractMentionParts.mockReturnValue([])
    mockRenderMentionedVersionsForPrompt.mockReturnValue("")

  it("records generate usage cost fields", async () => {
    mockGenerateLogoImage.mockResolvedValue({ imageBuffer: Buffer.from("img"), mimeType: "image/webp" })
    mockStreamText.mockImplementation((config: any) => ({
      toUIMessageStreamResponse: async () => {
        await config.tools.generate_batch.execute({ prompt: "p", count: 1, aspectRatio: "1:1" })
        await config.onFinish({ text: "done", steps: [], usage: { inputTokens: 100, outputTokens: 20 } })
        return new Response("ok")
      },
    }))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: "project-1", messages: [{ role: "user", parts: [{ type: "text", text: "go" }] }] }),
    })
    await POST(req)

    const generateCall = prismaMock.usageLog.create.mock.calls.find((call) => call[0]?.data?.type === "generate")
    expect(generateCall?.[0].data).toMatchObject({
      userId: "user-1",
      projectId: "project-1",
      type: "generate",
      count: 1,
      model: "gemini-3-pro-image-preview",
      imageCount: 1,
      imageCostUsd: imageCost(1),
      blobBytes: 2048,
      blobCostUsd: blobCost(2048),
    })
  })

  it("writes llm log with null cost when usage missing", async () => {
    mockStreamText.mockImplementation((config: any) => ({
      toUIMessageStreamResponse: async () => {
        await config.onFinish({ text: "done", steps: [] })
        return new Response("ok")
      },
    }))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: "project-1", messages: [{ role: "user", parts: [{ type: "text", text: "go" }] }] }),
    })

    await expect(POST(req)).resolves.toBeInstanceOf(Response)

    const llmCall = prismaMock.usageLog.create.mock.calls.find((call) => call[0]?.data?.type === "llm")
    expect(llmCall?.[0].data).toMatchObject({
      userId: "user-1",
      projectId: "project-1",
      type: "llm",
      count: 1,
      llmInputTokens: null,
      llmOutputTokens: null,
      llmCostUsd: null,
    })
  })

  it("writes both UsageLog and GeminiRequestLog in generate flow", async () => {
    mockGenerateLogoImage.mockImplementation(async () => {
      await prismaMock.geminiRequestLog.create({
        data: { model: "gemini-3-pro-image-preview", status: "ok", attempt: 1, latencyMs: 10 },
      })
      return { imageBuffer: Buffer.from("img"), mimeType: "image/webp" }
    })
    mockStreamText.mockImplementation((config: any) => ({
      toUIMessageStreamResponse: async () => {
        await config.tools.generate_batch.execute({ prompt: "p", count: 1, aspectRatio: "1:1" })
        await config.onFinish({ text: "done", steps: [], usage: { inputTokens: 10, outputTokens: 5 } })
        return new Response("ok")
      },
    }))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: "project-1", messages: [{ role: "user", parts: [{ type: "text", text: "go" }] }] }),
    })
    await POST(req)

    expect(prismaMock.geminiRequestLog.create).toHaveBeenCalledTimes(1)
    expect(
      prismaMock.usageLog.create.mock.calls.some((call) =>
        call[0]?.data?.type === "generate" || call[0]?.data?.type === "llm"
      )
    ).toBe(true)
  })
})

describe("mention validation", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1", name: "P", _count: { logos: 0 } })
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: "sub-1",
      tier: "free",
      dailyGenerations: 0,
      dailyResetAt: new Date(Date.now() + 86_400_000),
    })
    prismaMock.chatMessage.create.mockResolvedValue({})
    prismaMock.usageLog.create.mockResolvedValue({})
    mockBuildSystemPrompt.mockReturnValue("system")
    mockExtractMentionParts.mockReturnValue(
      [
        {
          type: "data-mention",
          data: { logoId: "l1", versionId: "v-missing", orderIndex: 0, versionNumber: 1, imageUrl: "https://blob/1" },
        },
      ] as any
    )
    mockRenderMentionedVersionsForPrompt.mockReturnValue("## User-mentioned logo versions")
  })

  it("returns 400 mention_invalid and does not call LLM on invalid mention", async () => {
    const { MentionValidationError } = await import("./mentions")
    mockValidateMentions.mockRejectedValue(new MentionValidationError(["v-missing"]))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        messages: [{ role: "user", parts: [{ type: "text", text: "go" }] }],
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "mention_invalid", missingVersionIds: ["v-missing"] })
    expect(mockStreamText).not.toHaveBeenCalled()
    expect(prismaMock.chatMessage.create).not.toHaveBeenCalled()
  })

  it("returns 400 mention_invalid on cross-project mention", async () => {
    const { MentionValidationError } = await import("./mentions")
    mockValidateMentions.mockRejectedValue(new MentionValidationError(["v-cross"]))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        messages: [{ role: "user", parts: [{ type: "text", text: "go" }] }],
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "mention_invalid", missingVersionIds: ["v-cross"] })
    expect(mockStreamText).not.toHaveBeenCalled()
  })

  it("passes mention file parts to LLM and includes mention prompt section", async () => {
    mockValidateMentions.mockResolvedValue([
      {
        id: "v1",
        imageUrl: "https://blob/mentioned1.png",
        logo: { orderIndex: 0, prompt: "a" },
      },
      {
        id: "v2",
        imageUrl: "https://blob/mentioned2.png",
        logo: { orderIndex: 1, prompt: "b" },
      },
    ])
    mockStreamText.mockImplementation((config: any) => ({
      toUIMessageStreamResponse: async () => new Response("ok"),
    }))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        messages: [{ role: "user", parts: [{ type: "text", text: "merge" }] }],
      }),
    })
    await POST(req)

    const streamConfig = mockStreamText.mock.calls[0]?.[0]
    expect(streamConfig.messages[0].parts.filter((p: any) => p.type === "file")).toHaveLength(2)
    expect(streamConfig.messages[0].parts.map((p: any) => p.url)).toContain("https://blob/mentioned1.png")
    expect(streamConfig.messages[0].parts.map((p: any) => p.url)).toContain("https://blob/mentioned2.png")
    expect(mockBuildSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ mentionedSection: "## User-mentioned logo versions" })
    )
  })
})
