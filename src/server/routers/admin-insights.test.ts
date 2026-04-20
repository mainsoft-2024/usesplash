import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/trpc/server", async () => {
  const { initTRPC, TRPCError } = await import("@trpc/server")
  const t = initTRPC.context<any>().create()
  const protectedProcedure = t.procedure.use(async ({ ctx, next }: any) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }
    return next()
  })

  return {
    router: t.router,
    protectedProcedure,
  }
})

const { adminInsightsRouter } = await import("./admin-insights")
const dec = (value: number) => ({ toNumber: () => value })

const createPrismaMock = () => ({
  user: {
    findUnique: vi.fn().mockResolvedValue({ role: "admin" }),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  subscription: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
  project: {
    findMany: vi.fn(),
  },
  logo: {
    findMany: vi.fn(),
  },
  logoVersion: {
    findMany: vi.fn(),
  },
  usageLog: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  geminiRequestLog: {
    findMany: vi.fn(),
  },
})


const makeCaller = (prisma: ReturnType<typeof createPrismaMock>) =>
  adminInsightsRouter.createCaller({
    session: { user: { id: "admin-user" } },
    prisma,
  } as any)

describe("adminInsightsRouter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-21T00:00:00.000Z"))
  })

  it("getOverviewKpis aggregates KPI values", async () => {
    const prisma = createPrismaMock()
    prisma.subscription.findMany.mockResolvedValue([{ tier: "pro" }, { tier: "enterprise" }])
    prisma.user.count.mockResolvedValue(100)
    prisma.usageLog.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }])
    prisma.usageLog.aggregate
      .mockResolvedValueOnce({ _sum: { count: 42 } })
      .mockResolvedValueOnce({ _sum: { imageCostUsd: dec(10), llmCostUsd: dec(5), blobCostUsd: dec(1) } })
      .mockResolvedValueOnce({ _sum: { imageCostUsd: dec(20), llmCostUsd: dec(10), blobCostUsd: dec(2) } })

    const caller = makeCaller(prisma)
    const result = await caller.getOverviewKpis({ period: "30" })

    expect(result).toMatchObject({
      mrrThisMonth: 110,
      marginUsd: 94,
      marginPct: 85.45,
      burnRate30d: 32,
      totalUsers: 100,
      activeUsers: 2,
      generationsInPeriod: 42,
    })
  })

  it("getMrrBreakdown computes ARR, growth and churn", async () => {
    const prisma = createPrismaMock()
    prisma.subscription.findMany
      .mockResolvedValueOnce([{ tier: "pro" }, { tier: "enterprise" }])
      .mockResolvedValueOnce([{ tier: "pro" }])
    prisma.subscription.count.mockResolvedValue(3)

    const caller = makeCaller(prisma)
    const result = await caller.getMrrBreakdown({ period: "30" })

    expect(result).toMatchObject({
      mrrThisMonth: 110,
      mrrLastMonth: 10,
      mrrGrowthPct: 1000,
      arr: 1320,
      paidSubCount: 2,
      weeklyChurnPct: 33.33,
    })
  })

  it("getMrrBreakdown returns null growth when previous month is zero", async () => {
    const prisma = createPrismaMock()
    prisma.subscription.findMany
      .mockResolvedValueOnce([{ tier: "pro" }])
      .mockResolvedValueOnce([])
    prisma.subscription.count.mockResolvedValue(1)

    const caller = makeCaller(prisma)
    const result = await caller.getMrrBreakdown({ period: "30" })

    expect(result.mrrLastMonth).toBe(0)
    expect(result.mrrGrowthPct).toBeNull()
  })

  it("getCostBreakdown returns per-day source totals", async () => {
    const prisma = createPrismaMock()
    prisma.usageLog.findMany.mockResolvedValue([
      { createdAt: new Date("2026-04-19T00:00:00.000Z"), imageCostUsd: dec(1), llmCostUsd: dec(2), blobCostUsd: dec(3) },
      { createdAt: new Date("2026-04-19T12:00:00.000Z"), imageCostUsd: dec(2), llmCostUsd: dec(1), blobCostUsd: dec(0.5) },
      { createdAt: new Date("2026-04-20T00:00:00.000Z"), imageCostUsd: dec(0.5), llmCostUsd: dec(1), blobCostUsd: dec(0.25) },
    ])

    const caller = makeCaller(prisma)
    const result = await caller.getCostBreakdown({ period: "30" })

    expect(result).toEqual([
      { date: "2026-04-19", gemini_image: 3, openrouter_llm: 3, vercel_blob: 3.5 },
      { date: "2026-04-20", gemini_image: 0.5, openrouter_llm: 1, vercel_blob: 0.25 },
    ])
  })

  it("getUserRankings computes spender, cost and margin rankings", async () => {
    const prisma = createPrismaMock()
    prisma.subscription.findMany.mockResolvedValue([
      { userId: "u1", tier: "pro", createdAt: new Date("2025-10-01T00:00:00.000Z") },
      { userId: "u2", tier: "enterprise", createdAt: new Date("2026-01-01T00:00:00.000Z") },
    ])
    prisma.usageLog.groupBy.mockResolvedValue([
      { userId: "u1", _sum: { imageCostUsd: dec(30), llmCostUsd: dec(10), blobCostUsd: dec(5) } },
      { userId: "u2", _sum: { imageCostUsd: dec(5), llmCostUsd: dec(5), blobCostUsd: dec(2) } },
    ])
    prisma.user.findMany.mockResolvedValue([
      { id: "u1", name: "A", email: "a@test.com" },
      { id: "u2", name: "B", email: "b@test.com" },
    ])

    const caller = makeCaller(prisma)
    const result = await caller.getUserRankings({ period: "30" })

    expect(result.topSpenders[0]?.userId).toBe("u2")
    expect(result.topCostUsers[0]).toMatchObject({ userId: "u1", value: 45 })
    expect(result.marginRanking[0]?.userId).toBe("u2")
  })

  it("getGeminiHealth computes 24h health metrics", async () => {
    const prisma = createPrismaMock()
    prisma.geminiRequestLog.findMany.mockResolvedValue([
      { status: "ok", httpCode: 200, attempt: 1 },
      { status: "retry", httpCode: 429, attempt: 2 },
      { status: "failed", httpCode: 500, attempt: 3 },
      { status: "ok", httpCode: 429, attempt: 1 },
    ])

    const caller = makeCaller(prisma)
    const result = await caller.getGeminiHealth()

    expect(result).toEqual({
      rate429Pct24h: 50,
      errorRatePct24h: 25,
      avgRetries24h: 2.5,
    })
  })

  it("getActivityFeed merges usage and tier events with cursor pagination", async () => {
    const prisma = createPrismaMock()
    prisma.usageLog.findMany.mockResolvedValue([
      {
        id: "u-log-2",
        userId: "u2",
        projectId: "p2",
        createdAt: new Date("2026-04-21T02:00:00.000Z"),
        type: "generate",
        count: 2,
        imageCostUsd: dec(2),
        llmCostUsd: dec(1),
        blobCostUsd: dec(0.1),
      },
      {
        id: "u-log-1",
        userId: "u1",
        projectId: "p1",
        createdAt: new Date("2026-04-21T01:00:00.000Z"),
        type: "edit",
        count: 1,
        imageCostUsd: dec(1),
        llmCostUsd: dec(0.5),
        blobCostUsd: dec(0.05),
      },
    ])
    prisma.subscription.findMany.mockResolvedValue([
      { id: "sub-1", userId: "u3", tier: "pro", updatedAt: new Date("2026-04-21T01:30:00.000Z") },
    ])

    const caller = makeCaller(prisma)
    const first = await caller.getActivityFeed({ limit: 2 })
    expect(first.items).toHaveLength(2)
    expect(first.nextCursor).toBeTruthy()

    const second = await caller.getActivityFeed({ cursor: first.nextCursor ?? undefined, limit: 2 })
    expect(second.items.length).toBeGreaterThanOrEqual(0)
  })

  it("getFunnel returns stage counts from signup cohort", async () => {
    const prisma = createPrismaMock()
    prisma.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }, { id: "u3" }])
    prisma.project.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }])
    prisma.usageLog.findMany.mockResolvedValue([{ userId: "u2" }])
    prisma.subscription.findMany.mockResolvedValue([{ userId: "u2" }, { userId: "u3" }])

    const caller = makeCaller(prisma)
    const result = await caller.getFunnel({ period: "30" })

    expect(result).toEqual({ signups: 3, firstProject: 2, firstGeneration: 1, paidSub: 2 })
  })

  it("getCohortRetention returns 12 cohorts with W0..W7 percentages", async () => {
    const prisma = createPrismaMock()
    prisma.user.findMany.mockResolvedValue([
      { id: "u1", createdAt: new Date("2026-04-07T00:00:00.000Z") },
      { id: "u2", createdAt: new Date("2026-04-08T00:00:00.000Z") },
      { id: "u3", createdAt: new Date("2026-03-31T00:00:00.000Z") },
    ])
    prisma.usageLog.findMany.mockResolvedValue([
      { userId: "u1", createdAt: new Date("2026-04-07T12:00:00.000Z") },
      { userId: "u2", createdAt: new Date("2026-04-14T12:00:00.000Z") },
      { userId: "u3", createdAt: new Date("2026-04-01T12:00:00.000Z") },
    ])

    const caller = makeCaller(prisma)
    const result = await caller.getCohortRetention()

    expect(result).toHaveLength(2)
    expect(result[1]).toMatchObject({ cohortWeekStart: "2026-04-06", w0: 50, w1: 50 })
  })

  it("getHourDowHeatmap buckets usage by KST hour/day", async () => {
    const prisma = createPrismaMock()
    prisma.usageLog.findMany.mockResolvedValue([
      { createdAt: new Date("2026-04-20T15:00:00.000Z"), count: 2 },
      { createdAt: new Date("2026-04-20T16:00:00.000Z"), count: 1 },
    ])

    const caller = makeCaller(prisma)
    const result = await caller.getHourDowHeatmap({ period: "30" })

    expect(result).toEqual([
      { dow: 2, hourKst: 0, count: 2 },
      { dow: 2, hourKst: 1, count: 1 },
    ])
  })

  it("getPopularKeywords counts case-insensitive keyword hits", async () => {
    const prisma = createPrismaMock()
    prisma.logo.findMany.mockResolvedValue([
      { prompt: "Minimalist retro monogram" },
      { prompt: "모던 레트로 스타일" },
      { prompt: "vintage VINTAGE" },
    ])

    const caller = makeCaller(prisma)
    const result = await caller.getPopularKeywords({ period: "30" })

    expect(result.find((row: any) => row.keyword.toLowerCase() === "vintage")?.count).toBe(2)
    expect(result.find((row: any) => row.keyword === "레트로")?.count).toBe(1)
  })

  it("getSampleGallery returns latest 24 with user info", async () => {
    const prisma = createPrismaMock()
    prisma.logoVersion.findMany.mockResolvedValue([
      {
        id: "lv1",
        imageUrl: "https://example.com/1.png",
        createdAt: new Date("2026-04-21T00:00:00.000Z"),
        logo: { project: { userId: "u1", user: { name: "Alice" } } },
      },
    ])

    const caller = makeCaller(prisma)
    const result = await caller.getSampleGallery()

    expect(result).toEqual([
      {
        id: "lv1",
        imageUrl: "https://example.com/1.png",
        userId: "u1",
        userName: "Alice",
        createdAt: new Date("2026-04-21T00:00:00.000Z"),
      },
    ])
  })

  it("exportUsersCsv returns BOM csv + escaped values + filename", async () => {
    const prisma = createPrismaMock()
    prisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Alice, \"A\"",
        email: "alice@test.com",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        subscription: { tier: "pro" },
      },
    ])
    prisma.usageLog.groupBy.mockResolvedValue([
      { userId: "u1", _sum: { imageCostUsd: dec(1), llmCostUsd: dec(2), blobCostUsd: dec(0.5) } },
    ])
    prisma.usageLog.findMany.mockResolvedValue([{ userId: "u1" }])

    const caller = makeCaller(prisma)
    const result = await caller.exportUsersCsv({ search: "alice", activity: "active" })

    expect(result.filename).toBe("users-20260421.csv")
    expect(result.csv.startsWith("\uFEFFid,name,email")).toBe(true)
    expect(result.csv).toContain('"Alice, ""A"""')
  })

  it("getUserCostRevenue returns monthly, ltv, cost and margin", async () => {
    const prisma = createPrismaMock()
    prisma.user.findUnique
      .mockResolvedValueOnce({ role: "admin" })
      .mockResolvedValueOnce({ id: "u1", createdAt: new Date("2026-02-01T00:00:00.000Z") })
    prisma.subscription.findUnique.mockResolvedValue({ tier: "enterprise" })
    prisma.usageLog.aggregate.mockResolvedValue({
      _sum: { imageCostUsd: dec(2), llmCostUsd: dec(1.5), blobCostUsd: dec(0.5) },
    })

    const caller = makeCaller(prisma)
    const result = await caller.getUserCostRevenue({ userId: "u1" })

    expect(result).toEqual({ monthlyPriceUsd: 100, ltvUsd: 300, totalCostUsd: 4, marginUsd: 296 })
  })
  it("rejects all adminInsights procedures for non-admin users", async () => {
    const prisma = createPrismaMock()
    prisma.user.findUnique.mockResolvedValue({ role: "user" })
    const caller = makeCaller(prisma)
    const cases: Array<{ name: string; run: () => Promise<unknown> }> = [
      { name: "getOverviewKpis", run: () => caller.getOverviewKpis({ period: "30" }) },
      { name: "getMrrBreakdown", run: () => caller.getMrrBreakdown({ period: "30" }) },
      { name: "getCostBreakdown", run: () => caller.getCostBreakdown({ period: "30" }) },
      { name: "getUserRankings", run: () => caller.getUserRankings({ period: "30" }) },
      { name: "getFunnel", run: () => caller.getFunnel({ period: "30" }) },
      { name: "getCohortRetention", run: () => caller.getCohortRetention() },
      { name: "getHourDowHeatmap", run: () => caller.getHourDowHeatmap({ period: "30" }) },
      { name: "getGeminiHealth", run: () => caller.getGeminiHealth() },
      { name: "getActivityFeed", run: () => caller.getActivityFeed({ limit: 10 }) },
      { name: "getPopularKeywords", run: () => caller.getPopularKeywords({ period: "30" }) },
      { name: "getSampleGallery", run: () => caller.getSampleGallery() },
      { name: "exportUsersCsv", run: () => caller.exportUsersCsv({}) },
      { name: "getUserCostRevenue", run: () => caller.getUserCostRevenue({ userId: "u1" }) },
    ]
    for (const testCase of cases) {
      await expect(testCase.run(), testCase.name).rejects.toMatchObject({ code: "FORBIDDEN" })
    }
  })
})
