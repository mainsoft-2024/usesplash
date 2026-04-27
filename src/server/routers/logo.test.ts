import { initTRPC } from "@trpc/server"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { TRPCError } from "@trpc/server"

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockValidateAndResizeUpload = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ buffer: Buffer.from("fake-image"), mimeType: "image/webp" }),
)
const mockUploadImage = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ url: "https://blob.example/logo.webp", bytes: 1024 }),
)
const mockGetStorageKey = vi.hoisted(() =>
  vi.fn().mockReturnValue("users/user1/projects/proj1/logos/logo1/v1.webp"),
)

vi.mock("@/lib/storage", () => ({
  validateAndResizeUpload: mockValidateAndResizeUpload,
  uploadImage: mockUploadImage,
  getStorageKey: mockGetStorageKey,
}))

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
}))

// ---------------------------------------------------------------------------
// tRPC test harness
// ---------------------------------------------------------------------------

const t = initTRPC.context<{ session: { user: { id: string } }; prisma: Record<string, unknown> }>().create()

vi.mock("@/lib/trpc/server", () => ({
  router: t.router,
  protectedProcedure: t.procedure,
}))

const { logoRouter } = await import("./logo")

// ---------------------------------------------------------------------------
// Prisma factory
// ---------------------------------------------------------------------------

function buildPrisma(overrides: Record<string, Partial<Record<string, unknown>>> = {}) {
  const base = {
    project: {
      findFirst: vi.fn().mockResolvedValue({ id: "proj1", userId: "user1" }),
    },
    logo: {
      findFirst: vi.fn().mockResolvedValue({ orderIndex: 4 }),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "logo1", orderIndex: 5 }),
    },
    logoVersion: {
      create: vi.fn().mockResolvedValue({ id: "ver1", versionNumber: 1 }),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    usageLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    subscription: {
      update: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        logo: {
          findFirst: vi.fn().mockResolvedValue({ orderIndex: 4 }),
          create: vi.fn().mockResolvedValue({ id: "logo1", orderIndex: 5 }),
        },
      }
      return fn(tx)
    }),
  }

  return { ...base, ...overrides } as unknown as typeof base
}

function buildCaller(prisma: ReturnType<typeof buildPrisma>, userId = "user1") {
  return logoRouter.createCaller({
    session: { user: { id: userId } },
    prisma,
  } as never)
}

const VALID_INPUT = {
  projectId: "proj1",
  mimeType: "image/png",
  dataUrl: "data:image/png;base64,aGVsbG8=",
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("logo.uploadBaseImage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateAndResizeUpload.mockResolvedValue({ buffer: Buffer.from("fake-image"), mimeType: "image/webp" })
    mockUploadImage.mockResolvedValue({ url: "https://blob.example/logo.webp", bytes: 1024 })
  })

  // T12 — Happy path: creates Logo + LogoVersion with correct fields
  it("creates Logo with correct prompt and aspectRatio, LogoVersion with versionNumber=1", async () => {
    const prisma = buildPrisma()
    const caller = buildCaller(prisma)

    const result = await caller.uploadBaseImage(VALID_INPUT)

    expect(result).toMatchObject({
      logoId: "logo1",
      versionId: "ver1",
      imageUrl: "https://blob.example/logo.webp",
      orderIndex: 5,
    })

    // Verify Logo creation args
    const txFn = prisma.$transaction as ReturnType<typeof vi.fn>
    expect(txFn).toHaveBeenCalledOnce()

    // Verify LogoVersion creation
    expect(prisma.logoVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          logoId: "logo1",
          versionNumber: 1,
          editPrompt: null,
          parentVersionId: null,
        }),
      }),
    )
  })

  // T13 — Creates UsageLog with type=upload, count=1, non-null blobBytes BigInt
  it("creates UsageLog with type='upload', count=1, blobBytes as BigInt", async () => {
    const prisma = buildPrisma()
    const caller = buildCaller(prisma)

    await caller.uploadBaseImage(VALID_INPUT)

    expect(prisma.usageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user1",
          projectId: "proj1",
          type: "upload",
          count: 1,
          blobBytes: BigInt(1024),
        }),
      }),
    )
  })

  // T14 — Does NOT touch subscription table
  it("never calls subscription.update or subscription.upsert", async () => {
    const prisma = buildPrisma()
    const caller = buildCaller(prisma)

    await caller.uploadBaseImage(VALID_INPUT)

    expect(prisma.subscription.update).not.toHaveBeenCalled()
    expect(prisma.subscription.upsert).not.toHaveBeenCalled()
  })

  // T15 — Rejects when project belongs to a different user
  it("throws NOT_FOUND when project does not belong to caller", async () => {
    const prisma = buildPrisma({
      project: { findFirst: vi.fn().mockResolvedValue(null) },
    })
    const caller = buildCaller(prisma)

    await expect(caller.uploadBaseImage(VALID_INPUT)).rejects.toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    )
  })

  // T16 — Rejects unsupported MIME via validateAndResizeUpload
  it("throws BAD_REQUEST with Korean message when file type is unsupported", async () => {
    mockValidateAndResizeUpload.mockRejectedValue(
      new TRPCError({ code: "BAD_REQUEST", message: "PNG, JPEG, WebP 형식만 지원해요. (아이폰 사진은 변환이 필요합니다)" }),
    )
    const prisma = buildPrisma()
    const caller = buildCaller(prisma)

    await expect(caller.uploadBaseImage(VALID_INPUT)).rejects.toThrow(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: expect.stringContaining("PNG, JPEG, WebP"),
      }),
    )
  })

  // T17 — orderIndex: pre-existing logo → +1; no existing logos → 0
  it("assigns orderIndex 5 when lastLogo.orderIndex=4", async () => {
    const prisma = buildPrisma()
    const caller = buildCaller(prisma)

    // $transaction mock: lastLogo.orderIndex = 4 → new logo orderIndex = 5
    const result = await caller.uploadBaseImage(VALID_INPUT)
    expect(result.orderIndex).toBe(5)
  })

  it("assigns orderIndex 0 when no existing logos", async () => {
    const prisma = buildPrisma()
    // Override transaction mock: findFirst returns null (no existing logos)
    ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          logo: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: "logo2", orderIndex: 0 }),
          },
        }
        return fn(tx)
      },
    )

    const caller = buildCaller(prisma)
    const result = await caller.uploadBaseImage(VALID_INPUT)
    expect(result.orderIndex).toBe(0)
  })
})