import { describe, expect, it, vi } from "vitest"
import { extractMentionParts, MentionValidationError, validateMentions } from "./mentions"

describe("mention pipeline", () => {
  it("extractMentionParts returns only data-mention parts", () => {
    const message = {
      role: "user",
      parts: [
        { type: "text", text: "hello" },
        { type: "data-mention", data: { logoId: "l1", versionId: "v1", orderIndex: 0, versionNumber: 1, imageUrl: "https://blob/1" } },
        { type: "file", url: "https://blob/file", mediaType: "image/png" },
      ],
    } as any

    const mentions = extractMentionParts(message)
    expect(mentions).toHaveLength(1)
    expect(mentions[0].type).toBe("data-mention")
    expect(mentions[0].data.versionId).toBe("v1")
  })

  it("validateMentions returns versions when all version ids are valid", async () => {
    const prisma = {
      logoVersion: {
        findMany: vi.fn().mockResolvedValue([
          { id: "v1", logo: { projectId: "p1" } },
          { id: "v2", logo: { projectId: "p1" } },
        ]),
      },
    }

    const mentions = [
      { type: "data-mention", data: { logoId: "l1", versionId: "v1", orderIndex: 0, versionNumber: 1, imageUrl: "https://blob/1" } },
      { type: "data-mention", data: { logoId: "l2", versionId: "v2", orderIndex: 1, versionNumber: 1, imageUrl: "https://blob/2" } },
    ] as any

    await expect(validateMentions(mentions, "p1", prisma as any)).resolves.toHaveLength(2)
  })

  it("validateMentions throws MentionValidationError for missing version ids", async () => {
    const prisma = {
      logoVersion: {
        findMany: vi.fn().mockResolvedValue([{ id: "v1", logo: { projectId: "p1" } }]),
      },
    }

    const mentions = [
      { type: "data-mention", data: { logoId: "l1", versionId: "v1", orderIndex: 0, versionNumber: 1, imageUrl: "https://blob/1" } },
      { type: "data-mention", data: { logoId: "l2", versionId: "v2", orderIndex: 1, versionNumber: 1, imageUrl: "https://blob/2" } },
    ] as any

    await expect(validateMentions(mentions, "p1", prisma as any)).rejects.toBeInstanceOf(MentionValidationError)
  })

  it("validateMentions throws MentionValidationError for cross-project versions", async () => {
    const prisma = {
      logoVersion: {
        findMany: vi.fn().mockResolvedValue([{ id: "v1", logo: { projectId: "p2" } }]),
      },
    }

    const mentions = [
      { type: "data-mention", data: { logoId: "l1", versionId: "v1", orderIndex: 0, versionNumber: 1, imageUrl: "https://blob/1" } },
    ] as any

    await expect(validateMentions(mentions, "p1", prisma as any)).rejects.toBeInstanceOf(MentionValidationError)
  })
})
