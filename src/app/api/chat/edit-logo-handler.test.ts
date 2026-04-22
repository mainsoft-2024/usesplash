import { beforeEach, describe, expect, it, vi } from "vitest"
import { runEditLogo } from "./edit-logo"

describe("runEditLogo", () => {
  const editLogoImage = vi.fn()
  const fetchImageBufferFromUrl = vi.fn()
  const uploadImage = vi.fn()
  const getStorageKey = vi.fn(() => "key")

  const prisma = {
    logo: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    logoVersion: { findMany: vi.fn(), create: vi.fn() },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    fetchImageBufferFromUrl.mockResolvedValue({ buffer: Buffer.from("src"), mimeType: "image/png" })
    editLogoImage.mockResolvedValue({ imageBuffer: Buffer.from("out"), mimeType: "image/png" })
    uploadImage.mockResolvedValue({ url: "https://blob/out.png", bytes: 111 })
    prisma.logo.findFirst.mockResolvedValue({
      id: "logo-1",
      orderIndex: 0,
      aspectRatio: "1:1",
      versions: [{ id: "v-latest", versionNumber: 2, imageUrl: "https://blob/src.png" }],
    })
    prisma.logo.findUnique.mockResolvedValue({
      id: "logo-1",
      orderIndex: 0,
      aspectRatio: "1:1",
      versions: [{ id: "v-latest", versionNumber: 2, imageUrl: "https://blob/src.png" }],
    })
    prisma.logoVersion.findMany.mockResolvedValue([])
    prisma.logoVersion.create.mockResolvedValue({ id: "v-new" })
  })

  const ctx = {
    prisma,
    projectId: "project-1",
    userId: "user-1",
    editLogoImage,
    fetchImageBufferFromUrl,
    uploadImage,
    getStorageKey,
  }

  it("new_version with legacy logoOrderIndex appends a version", async () => {
    const result = await runEditLogo({ logoOrderIndex: 1, editPrompt: "make it bold", outputMode: "new_version" }, ctx as any)

    expect(prisma.logoVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentVersionId: "v-latest", versionNumber: 3, logoId: "logo-1" }),
      })
    )
    expect(result).toMatchObject({ versionNumber: 3 })
  })

  it("new_version without logoOrderIndex resolves target logo from first ref", async () => {
    prisma.logoVersion.findMany.mockResolvedValue([
      { id: "ref-1", imageUrl: "https://blob/ref1.png", logoId: "logo-1", logo: { id: "logo-1", projectId: "project-1" } },
    ])

    await runEditLogo({ editPrompt: "adjust", outputMode: "new_version", referencedVersions: ["ref-1"] }, ctx as any)

    expect(prisma.logo.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "logo-1" } })
    )
  })

  it("new_logo with refs creates new logo with parentVersionId from first ref", async () => {
    prisma.logoVersion.findMany.mockResolvedValue([
      { id: "ref-1", imageUrl: "https://blob/ref1.png", logoId: "logo-1", logo: { id: "logo-1", projectId: "project-1" } },
      { id: "ref-2", imageUrl: "https://blob/ref2.png", logoId: "logo-2", logo: { id: "logo-2", projectId: "project-1" } },
    ])
    prisma.logo.findFirst
      .mockResolvedValueOnce({
        id: "logo-1",
        orderIndex: 0,
        aspectRatio: "1:1",
        versions: [{ id: "v-latest", versionNumber: 2, imageUrl: "https://blob/src.png" }],
      })
      .mockResolvedValueOnce({ id: "logo-last", orderIndex: 3 })
    prisma.logo.create.mockResolvedValue({ id: "logo-4", orderIndex: 4 })

    const result = await runEditLogo(
      { editPrompt: "merge", outputMode: "new_logo", referencedVersions: ["ref-1", "ref-2"] },
      ctx as any
    )

    expect(prisma.logo.create).toHaveBeenCalled()
    expect(prisma.logoVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ logoId: "logo-4", versionNumber: 1, parentVersionId: "ref-1" }) })
    )
    expect(result).toMatchObject({ logoId: "logo-4", versionNumber: 1 })
  })

  it("new_logo with empty refs falls back to new_version", async () => {
    await runEditLogo({ logoOrderIndex: 1, editPrompt: "tweak", outputMode: "new_logo", referencedVersions: [] }, ctx as any)
    expect(prisma.logo.create).not.toHaveBeenCalled()
    expect(prisma.logoVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ versionNumber: 3, logoId: "logo-1" }) })
    )
  })

  it("passes referenced buffers into editLogoImage", async () => {
    prisma.logoVersion.findMany.mockResolvedValue([
      { id: "ref-1", imageUrl: "https://blob/ref1.png", logoId: "logo-1", logo: { id: "logo-1", projectId: "project-1" } },
      { id: "ref-2", imageUrl: "https://blob/ref2.png", logoId: "logo-2", logo: { id: "logo-2", projectId: "project-1" } },
    ])

    await runEditLogo({ logoOrderIndex: 1, editPrompt: "refs", referencedVersions: ["ref-1", "ref-2"] }, ctx as any)

    expect(editLogoImage).toHaveBeenCalled()
    const refs = editLogoImage.mock.calls[0][3]
    expect(refs).toHaveLength(2)
  })
})
