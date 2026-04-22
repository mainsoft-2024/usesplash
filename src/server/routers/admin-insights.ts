import { z } from "zod"
import { PLAN_PRICE_USD } from "@/lib/pricing"
import { STYLE_KEYWORDS } from "@/lib/style-keywords"
import { router } from "@/lib/trpc/server"
import { adminProcedure } from "./_admin-procedure"

const PERIOD_ENUM = z.enum(["7", "30", "90", "all"])
const PERIOD_INPUT = z.object({ period: PERIOD_ENUM })

type Period = z.infer<typeof PERIOD_ENUM>

type ActivityEvent = {
  id: string
  createdAt: Date
  kind: "usage" | "tier_change"
  userId: string
  payload: Record<string, unknown>
}

const DAY_MS = 24 * 60 * 60 * 1000
const PAID_TIERS = ["pro", "enterprise"] as const

const toNumber = (value: unknown): number => {
  if (value == null) return 0
  if (typeof value === "number") return value
  if (typeof value === "object" && value && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber()
  }
  return Number(value)
}

const getPeriodStart = (period: Period): Date | undefined => {
  if (period === "all") return undefined
  const days = Number(period)
  return new Date(Date.now() - (days - 1) * DAY_MS)
}

const getMonthStartUtc = (date = new Date()) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))

const getWeekStartUtc = (date = new Date()) => {
  const day = date.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff))
}

const dateKey = (date: Date) => date.toISOString().slice(0, 10)

const encodeCursor = (createdAt: Date, id: string) =>
  Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString("base64")

const decodeCursor = (cursor: string) => {
  const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8")) as {
    createdAt: string
    id: string
  }
  return { createdAt: new Date(parsed.createdAt), id: parsed.id }
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const MONDAY_INDEX = 1
const CSV_FILTER_INPUT = z.object({
  tiers: z.array(z.string()).optional(),
  activity: z.enum(["active", "inactive"]).optional(),
  signupFrom: z.coerce.date().optional(),
  signupTo: z.coerce.date().optional(),
  search: z.string().trim().optional(),
})
const USER_ID_INPUT = z.object({ userId: z.string().min(1) })
const DATE_RANGE_INPUT = z.object({ from: z.coerce.date(), to: z.coerce.date() })

const toKst = (utcDate: Date) => {
  // Store timestamps in UTC; shift by +9h and read UTC parts to avoid host timezone/DST effects.
  return new Date(utcDate.getTime() + KST_OFFSET_MS)
}

const getKstIsoWeekStart = (date: Date) => {
  const kst = toKst(date)
  const day = kst.getUTCDay()
  const diffToMonday = day === 0 ? 6 : day - MONDAY_INDEX
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - diffToMonday))
}

const weekKey = (date: Date) => getKstIsoWeekStart(date).toISOString().slice(0, 10)

const addWeeks = (weekStart: Date, weeks: number) => {
  const copy = new Date(weekStart)
  copy.setUTCDate(copy.getUTCDate() + weeks * 7)
  return copy
}

const getMonthDiff = (from: Date, to: Date) => {
  const yearDiff = to.getUTCFullYear() - from.getUTCFullYear()
  const monthDiff = to.getUTCMonth() - from.getUTCMonth()
  return Math.max(0, yearDiff * 12 + monthDiff + 1)
}

const escapeCsvField = (value: string) => {
  if (!/[",\n]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}

const buildUserFilters = (filters: z.infer<typeof CSV_FILTER_INPUT>) => {
  const where: Record<string, unknown> = {}
  if (filters.tiers?.length) {
    where.subscription = { is: { tier: { in: filters.tiers } } }
  }
  if (filters.signupFrom || filters.signupTo) {
    where.createdAt = {
      ...(filters.signupFrom ? { gte: filters.signupFrom } : {}),
      ...(filters.signupTo ? { lte: filters.signupTo } : {}),
    }
  }
  if (filters.search) {
    where.OR = [
      { id: { contains: filters.search, mode: "insensitive" } },
      { name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ]
  }
  return where
}

const getCurrentMrr = async (prisma: {
  subscription: { findMany: (...args: any[]) => Promise<Array<{ tier: string }>> }
}) => {
  const subscriptions = await prisma.subscription.findMany({
    where: { tier: { in: [...PAID_TIERS] } },
    select: { tier: true },
  })

  return subscriptions.reduce((sum, subscription) => {
    const tier = subscription.tier as keyof typeof PLAN_PRICE_USD
    return sum + (PLAN_PRICE_USD[tier] ?? 0)
  }, 0)
}

export const adminInsightsRouter = router({
  getOverviewKpis: adminProcedure.input(PERIOD_INPUT).query(async ({ ctx, input }) => {
    const periodStart = getPeriodStart(input.period)
    const monthStart = getMonthStartUtc()
    const last30dStart = new Date(Date.now() - 29 * DAY_MS)

    const [mrrThisMonth, totalUsers, activeUserRows, generationAgg, thisMonthCostAgg, burnRateAgg] =
      await Promise.all([
        getCurrentMrr(ctx.prisma),
        ctx.prisma.user.count(),
        ctx.prisma.usageLog.findMany({
          where: {
            ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
          },
          select: { userId: true },
          distinct: ["userId"],
        }),
        ctx.prisma.usageLog.aggregate({
          where: {
            ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
            type: { in: ["generate", "edit"] },
          },
          _sum: { count: true },
        }),
        ctx.prisma.usageLog.aggregate({
          where: { createdAt: { gte: monthStart } },
          _sum: { imageCostUsd: true, llmCostUsd: true, blobCostUsd: true },
        }),
        ctx.prisma.usageLog.aggregate({
          where: { createdAt: { gte: last30dStart } },
          _sum: { imageCostUsd: true, llmCostUsd: true, blobCostUsd: true },
        }),
      ])

    const thisMonthCost =
      toNumber(thisMonthCostAgg._sum.imageCostUsd) +
      toNumber(thisMonthCostAgg._sum.llmCostUsd) +
      toNumber(thisMonthCostAgg._sum.blobCostUsd)

    const burnRate30d =
      toNumber(burnRateAgg._sum.imageCostUsd) +
      toNumber(burnRateAgg._sum.llmCostUsd) +
      toNumber(burnRateAgg._sum.blobCostUsd)

    const marginUsd = mrrThisMonth - thisMonthCost
    const marginPct = mrrThisMonth > 0 ? Number(((marginUsd / mrrThisMonth) * 100).toFixed(2)) : 0

    return {
      mrrThisMonth,
      marginUsd: Number(marginUsd.toFixed(6)),
      marginPct,
      burnRate30d: Number(burnRate30d.toFixed(6)),
      totalUsers,
      activeUsers: activeUserRows.length,
      generationsInPeriod: generationAgg._sum.count ?? 0,
    }
  }),

  getMrrBreakdown: adminProcedure.input(PERIOD_INPUT).query(async ({ ctx }) => {
    const monthStart = getMonthStartUtc()
    const lastMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1))
    const weekStart = getWeekStartUtc()

    const [currentPaidRows, previousPaidRows] = await Promise.all([
      ctx.prisma.subscription.findMany({ where: { tier: { in: [...PAID_TIERS] } }, select: { tier: true } }),
      ctx.prisma.subscription.findMany({
        where: {
          tier: { in: [...PAID_TIERS] },
          createdAt: { lt: monthStart, gte: lastMonthStart },
        },
        select: { tier: true },
      }),
    ])

    const mrrThisMonth = currentPaidRows.reduce((sum, row) => {
      const tier = row.tier as keyof typeof PLAN_PRICE_USD
      return sum + (PLAN_PRICE_USD[tier] ?? 0)
    }, 0)
    const mrrLastMonth = previousPaidRows.reduce((sum, row) => {
      const tier = row.tier as keyof typeof PLAN_PRICE_USD
      return sum + (PLAN_PRICE_USD[tier] ?? 0)
    }, 0)

    const mrrGrowthPct =
      mrrLastMonth === 0 ? null : Number((((mrrThisMonth - mrrLastMonth) / mrrLastMonth) * 100).toFixed(2))

    const paidSubCount = currentPaidRows.length

    const paidAtWeekStart = await ctx.prisma.subscription.count({
      where: {
        tier: { in: [...PAID_TIERS] },
        createdAt: { lt: weekStart },
      },
    })

    const weeklyChurnPct =
      paidAtWeekStart > paidSubCount
        ? Number((((paidAtWeekStart - paidSubCount) / paidAtWeekStart) * 100).toFixed(2))
        : 0

    return {
      mrrThisMonth,
      mrrLastMonth,
      mrrGrowthPct,
      arr: mrrThisMonth * 12,
      paidSubCount,
      weeklyChurnPct,
    }
  }),

  getCostBreakdown: adminProcedure.input(PERIOD_INPUT).query(async ({ ctx, input }) => {
    const periodStart = getPeriodStart(input.period)
    const rows = await ctx.prisma.usageLog.findMany({
      where: {
        ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
      },
      select: {
        createdAt: true,
        type: true,
        imageCostUsd: true,
        llmCostUsd: true,
        blobCostUsd: true,
      },
      orderBy: { createdAt: "asc" },
    })

    const map = new Map<
      string,
      { date: string; gemini_image: number; recraft_vectorize: number; openrouter_llm: number; vercel_blob: number }
    >()

    for (const row of rows) {
      const key = dateKey(row.createdAt)
      const existing = map.get(key) ?? {
        date: key,
        gemini_image: 0,
        recraft_vectorize: 0,
        openrouter_llm: 0,
        vercel_blob: 0,
      }
      if (row.type === "vectorize") {
        existing.recraft_vectorize += toNumber(row.imageCostUsd)
      } else {
        existing.gemini_image += toNumber(row.imageCostUsd)
      }
      existing.openrouter_llm += toNumber(row.llmCostUsd)
      existing.vercel_blob += toNumber(row.blobCostUsd)
      map.set(key, existing)
    }

    return [...map.values()].map((row) => ({
      ...row,
      gemini_image: Number(row.gemini_image.toFixed(6)),
      openrouter_llm: Number(row.openrouter_llm.toFixed(6)),
      vercel_blob: Number(row.vercel_blob.toFixed(6)),
      recraft_vectorize: Number(row.recraft_vectorize.toFixed(6)),
    }))
  }),

  getUserRankings: adminProcedure.input(PERIOD_INPUT).query(async ({ ctx, input }) => {
    const periodStart = getPeriodStart(input.period)

    const [subscriptions, groupedCosts] = await Promise.all([
      ctx.prisma.subscription.findMany({
        where: { tier: { in: [...PAID_TIERS] } },
        select: { userId: true, tier: true, createdAt: true },
      }),
      ctx.prisma.usageLog.groupBy({
        by: ["userId"],
        where: {
          ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
        },
        _sum: { imageCostUsd: true, llmCostUsd: true, blobCostUsd: true },
      }),
    ])

    const now = Date.now()
    const ltvByUser = new Map<string, number>()
    for (const sub of subscriptions) {
      const monthsActive = Math.floor((now - sub.createdAt.getTime()) / (30 * DAY_MS))
      const tier = sub.tier as keyof typeof PLAN_PRICE_USD
      ltvByUser.set(sub.userId, (PLAN_PRICE_USD[tier] ?? 0) * Math.max(monthsActive, 0))
    }

    const costByUser = new Map<string, number>()
    for (const row of groupedCosts) {
      const total =
        toNumber(row._sum.imageCostUsd) + toNumber(row._sum.llmCostUsd) + toNumber(row._sum.blobCostUsd)
      costByUser.set(row.userId, total)
    }

    const allUserIds = Array.from(new Set([...ltvByUser.keys(), ...costByUser.keys()]))
    const users = allUserIds.length
      ? await ctx.prisma.user.findMany({
          where: { id: { in: allUserIds } },
          select: { id: true, name: true, email: true },
        })
      : []

    const userMap = new Map(users.map((user) => [user.id, user]))
    const asRow = (userId: string, value: number) => {
      const user = userMap.get(userId)
      return {
        userId,
        name: user?.name ?? null,
        email: user?.email ?? null,
        value: Number(value.toFixed(6)),
      }
    }

    const topSpenders = [...ltvByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, value]) => asRow(userId, value))

    const topCostUsers = [...costByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, value]) => asRow(userId, value))

    const marginRanking = allUserIds
      .map((userId) => [userId, (ltvByUser.get(userId) ?? 0) - (costByUser.get(userId) ?? 0)] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, value]) => asRow(userId, value))

    return { topSpenders, topCostUsers, marginRanking }
  }),

  getFunnel: adminProcedure.input(PERIOD_INPUT).query(async ({ ctx, input }) => {
    const periodStart = getPeriodStart(input.period)
    const users = await ctx.prisma.user.findMany({
      where: {
        ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
      },
      select: { id: true },
    })

    const userIds = users.map((user) => user.id)
    if (userIds.length === 0) {
      return { signups: 0, firstProject: 0, firstGeneration: 0, paidSub: 0 }
    }

    const [projectRows, generationRows, paidRows] = await Promise.all([
      ctx.prisma.project.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      ctx.prisma.usageLog.findMany({
        where: { userId: { in: userIds }, type: { in: ["generate", "edit"] } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      ctx.prisma.subscription.findMany({
        where: { userId: { in: userIds }, tier: { in: [...PAID_TIERS] } },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ])

    return {
      signups: userIds.length,
      firstProject: projectRows.length,
      firstGeneration: generationRows.length,
      paidSub: paidRows.length,
    }
  }),

  getCohortRetention: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.prisma.user.findMany({
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })

    const cohortBuckets = new Map<string, string[]>()
    for (const user of users) {
      const key = weekKey(user.createdAt)
      const existing = cohortBuckets.get(key) ?? []
      existing.push(user.id)
      cohortBuckets.set(key, existing)
    }

    const recentCohorts = [...cohortBuckets.keys()].sort((a, b) => b.localeCompare(a)).slice(0, 12).reverse()
    if (recentCohorts.length === 0) return []

    const cohortUserIds = recentCohorts.flatMap((key) => cohortBuckets.get(key) ?? [])
    const usageRows = await ctx.prisma.usageLog.findMany({
      where: {
        userId: { in: cohortUserIds },
        type: { in: ["generate", "edit"] },
      },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    })

    const userActiveWeeks = new Map<string, Set<string>>()
    for (const row of usageRows) {
      const set = userActiveWeeks.get(row.userId) ?? new Set<string>()
      set.add(weekKey(row.createdAt))
      userActiveWeeks.set(row.userId, set)
    }

    return recentCohorts.map((cohortWeekStart) => {
      const cohortUsers = cohortBuckets.get(cohortWeekStart) ?? []
      const cohortSize = cohortUsers.length
      const baseDate = new Date(`${cohortWeekStart}T00:00:00.000Z`)

      const result: Record<string, number | string> = { cohortWeekStart }
      for (let week = 0; week <= 7; week += 1) {
        const targetWeek = addWeeks(baseDate, week).toISOString().slice(0, 10)
        const retained = cohortUsers.filter((userId) => userActiveWeeks.get(userId)?.has(targetWeek)).length
        result[`w${week}`] = cohortSize === 0 ? 0 : Number(((retained / cohortSize) * 100).toFixed(2))
      }
      return result
    })
  }),

  getHourDowHeatmap: adminProcedure.input(PERIOD_INPUT).query(async ({ ctx, input }) => {
    const periodStart = getPeriodStart(input.period)
    const rows = await ctx.prisma.usageLog.findMany({
      where: {
        ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
        type: { in: ["generate", "edit"] },
      },
      select: { createdAt: true, count: true },
    })

    const buckets = new Map<string, { hourKst: number; dow: number; count: number }>()
    for (const row of rows) {
      const kst = toKst(row.createdAt)
      const hourKst = kst.getUTCHours()
      const dow = kst.getUTCDay()
      const key = `${dow}-${hourKst}`
      const existing = buckets.get(key) ?? { hourKst, dow, count: 0 }
      existing.count += row.count
      buckets.set(key, existing)
    }

    return [...buckets.values()].sort((a, b) => (a.dow - b.dow) || (a.hourKst - b.hourKst))
  }),

  getPopularKeywords: adminProcedure.input(PERIOD_INPUT).query(async ({ ctx, input }) => {
    const periodStart = getPeriodStart(input.period)
    const logos = await ctx.prisma.logo.findMany({
      where: {
        ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
      },
      select: { prompt: true },
    })

    const stats = STYLE_KEYWORDS.map((keyword) => ({ keyword, count: 0 }))
    for (const logo of logos) {
      const prompt = (logo.prompt ?? "").toLowerCase()
      for (const row of stats) {
        if (!prompt) continue
        const escaped = row.keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const matches = prompt.match(new RegExp(escaped, "gi"))
        row.count += matches?.length ?? 0
      }
    }

    return stats.filter((row) => row.count > 0).sort((a, b) => b.count - a.count).slice(0, 15)
  }),

  getSampleGallery: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.logoVersion.findMany({
      take: 24,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        imageUrl: true,
        createdAt: true,
        logo: {
          select: {
            project: {
              select: {
                userId: true,
                user: { select: { name: true } },
              },
            },
          },
        },
      },
    })

    return rows.map((row) => ({
      id: row.id,
      imageUrl: row.imageUrl,
      userId: row.logo.project.userId,
      userName: row.logo.project.user.name,
      createdAt: row.createdAt,
    }))
  }),

  exportUsersCsv: adminProcedure.input(CSV_FILTER_INPUT).query(async ({ ctx, input }) => {
    const userWhere = buildUserFilters(input)
    const users = await ctx.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        subscription: { select: { tier: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const usageRows = await ctx.prisma.usageLog.groupBy({
      by: ["userId"],
      where: { userId: { in: users.map((user) => user.id) } },
      _sum: { imageCostUsd: true, llmCostUsd: true, blobCostUsd: true },
    })
    const usageByUser = new Map(
      usageRows.map((row) => [
        row.userId,
        toNumber(row._sum.imageCostUsd) + toNumber(row._sum.llmCostUsd) + toNumber(row._sum.blobCostUsd),
      ]),
    )

    const now = new Date()
    const activeSince = new Date(now.getTime() - 30 * DAY_MS)
    const activeRows = await ctx.prisma.usageLog.findMany({
      where: { userId: { in: users.map((user) => user.id) }, createdAt: { gte: activeSince } },
      select: { userId: true },
      distinct: ["userId"],
    })
    const activeUsers = new Set(activeRows.map((row) => row.userId))

    const filteredUsers =
      input.activity == null
        ? users
        : users.filter((user) => (input.activity === "active" ? activeUsers.has(user.id) : !activeUsers.has(user.id)))

    const headers = ["id", "name", "email", "tier", "signupAt", "monthlyPriceUsd", "ltvUsd", "totalCostUsd", "marginUsd"]
    const lines = [headers.join(",")]

    for (const user of filteredUsers) {
      const tier = (user.subscription?.tier ?? "free") as keyof typeof PLAN_PRICE_USD
      const monthlyPriceUsd = PLAN_PRICE_USD[tier] ?? 0
      const ltvUsd = getMonthDiff(user.createdAt, now) * monthlyPriceUsd
      const totalCostUsd = Number((usageByUser.get(user.id) ?? 0).toFixed(6))
      const marginUsd = Number((ltvUsd - totalCostUsd).toFixed(6))

      const row = [
        user.id,
        user.name ?? "",
        user.email ?? "",
        tier,
        user.createdAt.toISOString(),
        String(monthlyPriceUsd),
        String(ltvUsd),
        String(totalCostUsd),
        String(marginUsd),
      ].map(escapeCsvField)

      lines.push(row.join(","))
    }

    const today = new Date()
    const filename = `users-${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, "0")}${String(today.getUTCDate()).padStart(2, "0")}.csv`
    return { csv: `\uFEFF${lines.join("\n")}`, filename }
  }),

  getUserCostRevenue: adminProcedure.input(USER_ID_INPUT).query(async ({ ctx, input }) => {
    const [user, subscription, costAgg, vectorizeCostAgg] = await Promise.all([
      ctx.prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, createdAt: true } }),
      ctx.prisma.subscription.findUnique({ where: { userId: input.userId }, select: { tier: true } }),
      ctx.prisma.usageLog.aggregate({
        where: { userId: input.userId },
        _sum: { imageCostUsd: true, llmCostUsd: true, blobCostUsd: true },
      }),
      ctx.prisma.usageLog.aggregate({
        where: { userId: input.userId, type: "vectorize" },
        _sum: { imageCostUsd: true },
      }),
    ])

    if (!user) {
      return { monthlyPriceUsd: 0, ltvUsd: 0, totalCostUsd: 0, marginUsd: 0, vectorizeCostUsd: 0 }
    }

    const tier = (subscription?.tier ?? "free") as keyof typeof PLAN_PRICE_USD
    const monthlyPriceUsd = PLAN_PRICE_USD[tier] ?? 0
    const ltvUsd = getMonthDiff(user.createdAt, new Date()) * monthlyPriceUsd
    const totalCostUsd = Number((
      toNumber(costAgg._sum.imageCostUsd) + toNumber(costAgg._sum.llmCostUsd) + toNumber(costAgg._sum.blobCostUsd)
).toFixed(6))
    const marginUsd = Number((ltvUsd - totalCostUsd).toFixed(6))
    const vectorizeCostUsd = Number(toNumber(vectorizeCostAgg._sum.imageCostUsd).toFixed(6))

    return { monthlyPriceUsd, ltvUsd, totalCostUsd, marginUsd, vectorizeCostUsd }
  }),

  getGeminiHealth: adminProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - 24 * DAY_MS)
    const rows = await ctx.prisma.geminiRequestLog.findMany({
      where: { createdAt: { gte: since } },
      select: { status: true, httpCode: true, attempt: true },
    })

    const total = rows.length
    if (total === 0) {
      return { rate429Pct24h: 0, errorRatePct24h: 0, avgRetries24h: 0 }
    }

    const rate429Pct24h = Number(((rows.filter((row) => row.httpCode === 429).length / total) * 100).toFixed(2))
    const errorRatePct24h = Number(((rows.filter((row) => row.status === "failed").length / total) * 100).toFixed(2))

    const nonOkAttempts = rows.filter((row) => row.status !== "ok")
    const avgRetries24h =
      nonOkAttempts.length > 0
        ? Number((nonOkAttempts.reduce((sum, row) => sum + row.attempt, 0) / nonOkAttempts.length).toFixed(2))
        : 0

    return { rate429Pct24h, errorRatePct24h, avgRetries24h }
  }),

  getRecraftHealth: adminProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - 24 * DAY_MS)
    const rows = await ctx.prisma.recraftRequestLog.findMany({
      where: { createdAt: { gte: since } },
      select: { status: true, httpCode: true, attempt: true },
    })

    const totalAttempts24h = rows.length
    if (totalAttempts24h === 0) {
      return { rate429Pct24h: 0, errorRatePct24h: 0, avgRetries24h: 0, totalAttempts24h: 0 }
    }

    const rate429Pct24h = Number(((rows.filter((row) => row.httpCode === 429).length / totalAttempts24h) * 100).toFixed(2))
    const errorRatePct24h = Number(((rows.filter((row) => row.status === "error").length / totalAttempts24h) * 100).toFixed(2))

    const nonOkAttempts = rows.filter((row) => row.status !== "ok")
    const avgRetries24h =
      nonOkAttempts.length > 0
        ? Number((nonOkAttempts.reduce((sum, row) => sum + row.attempt, 0) / nonOkAttempts.length).toFixed(2))
        : 0

    return { rate429Pct24h, errorRatePct24h, avgRetries24h, totalAttempts24h }
  }),

  getRecraftAggregates: adminProcedure.input(DATE_RANGE_INPUT).query(async ({ ctx, input }) => {
    const rows = await ctx.prisma.recraftRequestLog.findMany({
      where: {
        createdAt: { gte: input.from, lte: input.to },
      },
      select: { status: true, latencyMs: true },
    })

    const totalsByStatus = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1
      return acc
    }, {})

    const latency = rows
      .map((row) => row.latencyMs)
      .filter((value): value is number => Number.isFinite(value))
      .sort((a, b) => a - b)
    const percentile = (p: number) => {
      if (latency.length === 0) return 0
      const idx = Math.ceil((p / 100) * latency.length) - 1
      return latency[Math.min(Math.max(idx, 0), latency.length - 1)]
    }

    return {
      totalsByStatus,
      p50LatencyMs: percentile(50),
      p95LatencyMs: percentile(95),
      total: rows.length,
    }
  }),

  getActivityFeed: adminProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cursor = input.cursor ? decodeCursor(input.cursor) : null
      const fetchSize = input.limit * 3

      const [usageRows, tierRows] = await Promise.all([
        ctx.prisma.usageLog.findMany({
          where: {
            ...(cursor ? { createdAt: { lte: cursor.createdAt } } : {}),
          },
          select: {
            id: true,
            userId: true,
            projectId: true,
            createdAt: true,
            type: true,
            count: true,
            imageCostUsd: true,
            llmCostUsd: true,
            blobCostUsd: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: fetchSize,
        }),
        ctx.prisma.subscription.findMany({
          where: {
            ...(cursor ? { updatedAt: { lte: cursor.createdAt } } : {}),
          },
          select: { id: true, userId: true, tier: true, updatedAt: true },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: fetchSize,
        }),
      ])

      const allEvents: ActivityEvent[] = [
        ...usageRows.map((row) => ({
          id: `usage:${row.id}`,
          createdAt: row.createdAt,
          kind: "usage" as const,
          userId: row.userId,
          payload: {
            projectId: row.projectId,
            usageType: row.type,
            count: row.count,
            totalCostUsd: Number(
              (
                toNumber(row.imageCostUsd) +
                toNumber(row.llmCostUsd) +
                toNumber(row.blobCostUsd)
              ).toFixed(6),
            ),
          },
        })),
        ...tierRows.map((row) => ({
          id: `tier:${row.id}`,
          createdAt: row.updatedAt,
          kind: "tier_change" as const,
          userId: row.userId,
          payload: { tier: row.tier },
        })),
      ]

      allEvents.sort((a, b) => {
        const timeDiff = b.createdAt.getTime() - a.createdAt.getTime()
        if (timeDiff !== 0) return timeDiff
        return b.id.localeCompare(a.id)
      })

      const filtered = cursor
        ? allEvents.filter((event) => {
            if (event.createdAt.getTime() < cursor.createdAt.getTime()) return true
            if (event.createdAt.getTime() > cursor.createdAt.getTime()) return false
            return event.id < cursor.id
          })
        : allEvents

      const page = filtered.slice(0, input.limit + 1)
      const hasMore = page.length > input.limit
      const items = hasMore ? page.slice(0, input.limit) : page

      const nextCursor = hasMore ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id) : null

      return { items, nextCursor }
    }),
})
