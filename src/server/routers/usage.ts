import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc/server"
import { TIER_LIMITS } from "./subscription"

const DAILY_CHART_DAYS = z.union([z.literal(7), z.literal(30), z.literal(90)])

const toUTCDateKey = (date: Date) => date.toISOString().slice(0, 10)

export const usageRouter = router({
  getMyUsageStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

    const now = new Date()
    const todayMidnightUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    )
    const startOfMonthUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    )

    const [lifetimeAgg, todayAgg, vectorizeLifetime, vectorizeToday, vectorizeMonthly, subscription] = await Promise.all([
      ctx.prisma.usageLog.aggregate({
        where: { userId },
        _sum: { count: true },
      }),
      ctx.prisma.usageLog.aggregate({
        where: {
          userId,
          createdAt: { gte: todayMidnightUTC },
        },
        _sum: { count: true },
      }),
      ctx.prisma.usageLog.count({
        where: {
          userId,
          type: "vectorize",
        },
      }),
      ctx.prisma.usageLog.count({
        where: {
          userId,
          type: "vectorize",
          createdAt: { gte: todayMidnightUTC },
        },
      }),
      ctx.prisma.usageLog.count({
        where: {
          userId,
          type: "vectorize",
          createdAt: { gte: startOfMonthUTC },
        },
      }),
      ctx.prisma.subscription.findUnique({
        where: { userId },
        select: { tier: true },
      }),
    ])

    const tier = (subscription?.tier as keyof typeof TIER_LIMITS) ?? "free"
    const dailyLimit = TIER_LIMITS[tier]?.dailyGenerations ?? TIER_LIMITS.free.dailyGenerations
    const vectorizeLimit = TIER_LIMITS[tier]?.monthlyVectorizes ?? TIER_LIMITS.free.monthlyVectorizes
    const vectorizeRemaining = vectorizeLimit === -1 ? -1 : Math.max(vectorizeLimit - vectorizeMonthly, 0)
    const total = lifetimeAgg._sum.count ?? 0
    const today = todayAgg._sum.count ?? 0
    const remaining = dailyLimit === -1 ? -1 : Math.max(dailyLimit - today, 0)

    return {
      total,
      today,
      remaining,
      tier,
      dailyLimit,
      vectorizeToday,
      vectorizeLifetime,
      vectorizeMonthly,
      vectorizeLimit,
      vectorizeRemaining,
    }
  }),

  getDailyChart: protectedProcedure
    .input(z.object({ days: DAILY_CHART_DAYS }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const now = new Date()
      const todayMidnightUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      )
      const rangeStart = new Date(todayMidnightUTC)
      rangeStart.setUTCDate(rangeStart.getUTCDate() - (input.days - 1))

      const logs = await ctx.prisma.usageLog.findMany({
        where: {
          userId,
          createdAt: { gte: rangeStart },
        },
        select: { createdAt: true, count: true, type: true },
      })

      const countsByDate = new Map<
        string,
        { generate: number; edit: number; llm: number; vectorize: number; count: number }
      >()
      for (const log of logs) {
        const key = toUTCDateKey(log.createdAt)
        const existing = countsByDate.get(key) ?? {
          generate: 0,
          edit: 0,
          llm: 0,
          vectorize: 0,
          count: 0,
        }

        if (log.type === "generate") existing.generate += log.count
        if (log.type === "edit") existing.edit += log.count
        if (log.type === "llm") existing.llm += log.count
        if (log.type === "vectorize") existing.vectorize += log.count
        existing.count += log.count

        countsByDate.set(key, existing)
      }

      const chart: Array<{
        date: string
        generate: number
        edit: number
        llm: number
        vectorize: number
        count: number
      }> = []
      for (let i = 0; i < input.days; i++) {
        const day = new Date(rangeStart)
        day.setUTCDate(rangeStart.getUTCDate() + i)
        const key = toUTCDateKey(day)
        const bucket = countsByDate.get(key) ?? {
          generate: 0,
          edit: 0,
          llm: 0,
          vectorize: 0,
          count: 0,
        }

        chart.push({
          date: key,
          generate: bucket.generate,
          edit: bucket.edit,
          llm: bucket.llm,
          vectorize: bucket.vectorize,
          count: bucket.count,
        })
      }

      return chart
    }),
})
