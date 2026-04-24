import { beforeEach, describe, expect, it, vi } from "vitest"
import { runEditLogo } from "./edit-logo"

describe("runEditLogo", () => {
  const editLogoImage = vi.fn()
  const fetchImageBufferFromUrl = vi.fn()
  const uploadImage = vi.fn()
  const getStorageKey = vi.fn(() => "key")

  const prisma = {
    logo: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
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
    prisma.logo.findMany.mockResolvedValue([])
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

  it("uses exact referenced version as source when logoOrderIndex is omitted", async () => {
    prisma.logoVersion.findMany.mockResolvedValue([
      {
        id: "ref-1",
        versionNumber: 1,
        imageUrl: "https://blob/ref1.png",
        logoId: "logo-1",
        logo: { id: "logo-1", projectId: "project-1" },
      },
    ])
    fetchImageBufferFromUrl.mockImplementation(async (url: string) => ({
      buffer: Buffer.from(url),
      mimeType: "image/png",
    }))

    await runEditLogo({ editPrompt: "adjust", outputMode: "new_version", referencedVersions: ["ref-1"] }, ctx as any)

    expect(fetchImageBufferFromUrl).toHaveBeenNthCalledWith(1, "https://blob/ref1.png")
    expect(editLogoImage).toHaveBeenCalledWith(
      "adjust",
      Buffer.from("https://blob/ref1.png"),
      "image/png",
      expect.any(Array)
    )
  })

  it("new_version without logoOrderIndex resolves target logo from first ref", async () => {
    prisma.logoVersion.findMany.mockResolvedValue([
      { id: "ref-1", imageUrl: "https://blob/ref1.png", logoId: "logo-1", logo: { id: "logo-1", projectId: "project-1" } },
    ])

    await runEditLogo({ editPrompt: "adjust", outputMode: "new_version", referencedVersions: ["ref-1"] }, ctx as any)

    expect(prisma.logo.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "logo-1" } }))
  })

  it("resolves logoId references via latest version fallback and warns", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    prisma.logoVersion.findMany.mockResolvedValue([])
    prisma.logo.findMany.mockResolvedValue([
      {
        id: "logo-2",
        versions: [{ id: "v2-latest", versionNumber: 7, imageUrl: "https://blob/logo2-v7.png" }],
      },
    ])
    prisma.logo.findUnique.mockResolvedValue({
      id: "logo-2",
      orderIndex: 1,
      aspectRatio: "1:1",
      versions: [{ id: "v2-head", versionNumber: 8, imageUrl: "https://blob/logo2-head.png" }],
    })

    const result = await runEditLogo(
      { editPrompt: "adjust", outputMode: "new_version", referencedVersions: ["logo-2"] },
      ctx as any
    )

    expect(result).not.toHaveProperty("error")
    expect(prisma.logo.findMany).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      "[edit_logo] logoId→versionId fallback",
      expect.objectContaining({ matchedLogoId: "logo-2", resolvedVersionId: "v2-latest" })
    )
    expect(prisma.logoVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ parentVersionId: "v2-latest" }) })
    )
  })

  it("returns error when referenced id resolves to neither version nor logo", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    prisma.logoVersion.findMany.mockResolvedValue([])
    prisma.logo.findMany.mockResolvedValue([])

    const result = await runEditLogo(
      { editPrompt: "adjust", outputMode: "new_version", referencedVersions: ["missing-id"] },
      ctx as any
    )

    expect(result).toEqual({ error: "Referenced versions not found: missing-id" })
    expect(errorSpy).toHaveBeenCalledWith(
      "[edit_logo]",
      expect.objectContaining({ reason: "refs_not_found", projectId: "project-1" })
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

  it("merges referenced versions with referenceImageUrls, dedupes, caps at 3", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    prisma.logoVersion.findMany.mockResolvedValue([
      { id: "ref-1", imageUrl: "https://blob/ref1.png", logoId: "logo-1", logo: { id: "logo-1", projectId: "project-1" } },
      { id: "ref-2", imageUrl: "https://blob/ref2.png", logoId: "logo-2", logo: { id: "logo-2", projectId: "project-1" } },
    ])

    await runEditLogo(
      {
        logoOrderIndex: 1,
        editPrompt: "refs",
        referencedVersions: ["ref-1", "ref-2"],
        referenceImageUrls: ["https://blob/ref2.png", "https://blob/ext1.png", "https://blob/ext2.png"],
      },
      ctx as any
    )

    const refs = editLogoImage.mock.calls[0][3]
    expect(refs).toHaveLength(3)
    expect(fetchImageBufferFromUrl).toHaveBeenCalledWith("https://blob/ext1.png")
    expect(fetchImageBufferFromUrl).not.toHaveBeenCalledWith("https://blob/ext2.png")
    expect(warnSpy).toHaveBeenCalledWith(
      "[edit_logo] referenceImageUrls capped to 3",
      expect.objectContaining({ projectId: "project-1", requested: 4 })
    )
  })

  it.each([
    ["refs_not_found", { editPrompt: "x", referencedVersions: ["missing"] }, () => {
      prisma.logoVersion.findMany.mockResolvedValue([])
      prisma.logo.findMany.mockResolvedValue([])
    }],
    ["target_not_found", { logoOrderIndex: 9, editPrompt: "x" }, () => {
      prisma.logo.findFirst.mockResolvedValue(null)
    }],
    ["source_version_not_found", { logoOrderIndex: 1, versionNumber: 99, editPrompt: "x" }, () => {}],
    ["fetch_source_failed", { logoOrderIndex: 1, editPrompt: "x" }, () => {
      fetchImageBufferFromUrl.mockRejectedValueOnce(new Error("boom"))
    }],
    ["fetch_refs_failed", { logoOrderIndex: 1, editPrompt: "x", referencedVersions: ["ref-1"] }, () => {
      prisma.logoVersion.findMany.mockResolvedValue([
        { id: "ref-1", imageUrl: "https://blob/ref1.png", logoId: "logo-1", logo: { id: "logo-1", projectId: "project-1" } },
      ])
      fetchImageBufferFromUrl.mockResolvedValueOnce({ buffer: Buffer.from("src"), mimeType: "image/png" })
      fetchImageBufferFromUrl.mockRejectedValueOnce(new Error("ref fail"))
    }],
    ["gemini_error", { logoOrderIndex: 1, editPrompt: "x" }, () => {
      editLogoImage.mockRejectedValueOnce(new Error("gemini"))
    }],
    ["gemini_empty", { logoOrderIndex: 1, editPrompt: "x" }, () => {
      editLogoImage.mockResolvedValueOnce(null)
    }],
  ])("logs structured console.error reason=%s", async (reason, input, setup) => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    setup()

    await runEditLogo(input as any, ctx as any)

    expect(errorSpy).toHaveBeenCalledWith(
      "[edit_logo]",
      expect.objectContaining({ reason, projectId: "project-1" })
    )
  })
})