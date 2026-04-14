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

    const [lifetimeAgg, todayAgg, subscription] = await Promise.all([
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
      ctx.prisma.subscription.findUnique({
        where: { userId },
        select: { tier: true },
      }),
    ])

    const tier = (subscription?.tier as keyof typeof TIER_LIMITS) ?? "free"
    const dailyLimit = TIER_LIMITS[tier]?.dailyGenerations ?? TIER_LIMITS.free.dailyGenerations
    const total = lifetimeAgg._sum.count ?? 0
    const today = todayAgg._sum.count ?? 0
    const remaining = dailyLimit === -1 ? -1 : Math.max(dailyLimit - today, 0)

    return { total, today, remaining, tier, dailyLimit }
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
        select: { createdAt: true, count: true },
      })

      const countsByDate = new Map<string, number>()
      for (const log of logs) {
        const key = toUTCDateKey(log.createdAt)
        countsByDate.set(key, (countsByDate.get(key) ?? 0) + log.count)
      }

      const chart: Array<{ date: string; count: number }> = []
      for (let i = 0; i < input.days; i++) {
        const day = new Date(rangeStart)
        day.setUTCDate(rangeStart.getUTCDate() + i)
        const key = toUTCDateKey(day)
        chart.push({
          date: key,
          count: countsByDate.get(key) ?? 0,
        })
      }

      return chart
    }),
})
