import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { router } from "@/lib/trpc/server"
import { adminProcedure } from "./_admin-procedure"
import { PLAN_PRICE_USD } from "@/lib/pricing"

export const adminRouter = router({
  listUsers: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        search: z.string().optional(),
        tiers: z.array(z.string()).optional(),
        activity: z.enum(["active", "inactive"]).optional(),
        signupFrom: z.date().optional(),
        signupTo: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const page = Math.max(input.page, 1)
      const pageSize = Math.max(input.pageSize, 1)
      const skip = (page - 1) * pageSize

      const now = new Date()
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const andConditions = [
        input.search
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" as const } },
                { email: { contains: input.search, mode: "insensitive" as const } },
              ],
            }
          : undefined,
        input.tiers?.length
          ? (() => {
              const includesFree = input.tiers.includes("free")
              const paidTiers = input.tiers.filter((tier) => tier !== "free")

              if (includesFree && paidTiers.length > 0) {
                return {
                  OR: [
                    { subscription: { is: null } },
                    { subscription: { is: { tier: { in: paidTiers } } } },
                  ],
                }
              }

              if (includesFree) {
                return { subscription: { is: null } }
              }

              return { subscription: { is: { tier: { in: paidTiers } } } }
            })()
          : undefined,
        input.activity === "active"
          ? { usageLogs: { some: { createdAt: { gte: thirtyDaysAgo } } } }
          : input.activity === "inactive"
            ? { usageLogs: { none: { createdAt: { gte: thirtyDaysAgo } } } }
            : undefined,
        input.signupFrom || input.signupTo
          ? {
              createdAt: {
                ...(input.signupFrom ? { gte: input.signupFrom } : {}),
                ...(input.signupTo ? { lte: input.signupTo } : {}),
              },
            }
          : undefined,
      ].filter((condition): condition is NonNullable<typeof condition> => condition !== undefined)

      const where = andConditions.length > 0 ? { AND: andConditions } : undefined

      const [users, total] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            _count: { select: { projects: true } },
            subscription: { select: { tier: true } },
          },
        }),
        ctx.prisma.user.count({ where }),
      ])

      const userIds = users.map((user) => user.id)

      const usageGroups = userIds.length
        ? await ctx.prisma.usageLog.groupBy({
            by: ["userId"],
            where: { userId: { in: userIds } },
            _sum: {
              count: true,
              imageCostUsd: true,
              llmCostUsd: true,
              blobCostUsd: true,
            },
          })
        : []

      const usageMap = new Map(usageGroups.map((item) => [item.userId, item._sum]))

      const toNumber = (value: { toNumber: () => number } | number | null | undefined) => {
        if (value == null) return 0
        return typeof value === "number" ? value : value.toNumber()
      }

      const monthsSinceSignup = (joinedAt: Date) => {
        let months = (now.getFullYear() - joinedAt.getFullYear()) * 12
        months += now.getMonth() - joinedAt.getMonth()
        if (now.getDate() < joinedAt.getDate()) {
          months -= 1
        }
        return Math.max(months, 0)
      }
      return {
        users: users.map((user) => {
          const tier = (user.subscription?.tier ?? "free") as keyof typeof PLAN_PRICE_USD
          const ltvUsd = monthsSinceSignup(user.createdAt) * PLAN_PRICE_USD[tier]
          const totalCostUsd =
            toNumber(usageMap.get(user.id)?.imageCostUsd) +
            toNumber(usageMap.get(user.id)?.llmCostUsd) +
            toNumber(usageMap.get(user.id)?.blobCostUsd)

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            joinedAt: user.createdAt,
            projectCount: user._count.projects,
            tier: user.subscription?.tier ?? "free",
            totalGenerations: usageMap.get(user.id)?.count ?? 0,
            totalCostUsd,
            ltvUsd,
            marginUsd: ltvUsd - totalCostUsd,
          }
        }),
        total,
        page,
        pageSize,
      }
    }),

  getUserDetail: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          image: true,
          createdAt: true,
          subscription: { select: { tier: true } },
          projects: {
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              updatedAt: true,
              logos: {
                orderBy: { orderIndex: "asc" },
                select: {
                  id: true,
                  orderIndex: true,
                  versions: {
                    orderBy: { versionNumber: "desc" },
                    select: {
                      id: true,
                      imageUrl: true,
                      versionNumber: true,
                      createdAt: true,
                      editPrompt: true,
                    },
                  },
                },
              },
              chatMessages: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  role: true,
                  content: true,
                  parts: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      })

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." })
      }

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [totalUsage, todayUsage] = await Promise.all([
        ctx.prisma.usageLog.aggregate({
          where: { userId: input.userId },
          _sum: { count: true },
        }),
        ctx.prisma.usageLog.aggregate({
          where: {
            userId: input.userId,
            createdAt: { gte: todayStart },
          },
          _sum: { count: true },
        }),
      ])

      return {
        ...user,
        totalGenerations: totalUsage._sum.count ?? 0,
        todayGenerations: todayUsage._sum.count ?? 0,
      }
    }),

  getPlatformStats: adminProcedure.query(async ({ ctx }) => {
    const now = new Date()
    const todayMidnightUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    )

    const last7Start = new Date(todayMidnightUTC)
    last7Start.setUTCDate(last7Start.getUTCDate() - 6)

    const prev7Start = new Date(todayMidnightUTC)
    prev7Start.setUTCDate(prev7Start.getUTCDate() - 13)

    const [
      totalUsers,
      totalProjects,
      totalGenerationsAgg,
      activeUsersTodayList,
      proUserCount,
      recentGenerationLogs,
      recentUsers,
    ] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.project.count(),
      ctx.prisma.usageLog.aggregate({ _sum: { count: true } }),
      ctx.prisma.usageLog.findMany({
        where: { createdAt: { gte: todayMidnightUTC } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      ctx.prisma.subscription.count({
        where: { tier: { in: ["pro", "demo", "enterprise"] } },
      }),
      ctx.prisma.usageLog.findMany({
        where: { createdAt: { gte: prev7Start } },
        select: { createdAt: true, count: true },
      }),
      ctx.prisma.user.findMany({
        where: { createdAt: { gte: prev7Start } },
        select: { createdAt: true },
      }),
    ])

    const toUTCDateKey = (date: Date) => date.toISOString().slice(0, 10)

    const generationByDate = new Map<string, number>()
    for (const log of recentGenerationLogs) {
      const key = toUTCDateKey(log.createdAt)
      generationByDate.set(key, (generationByDate.get(key) ?? 0) + log.count)
    }

    const usersByDate = new Map<string, number>()
    for (const user of recentUsers) {
      const key = toUTCDateKey(user.createdAt)
      usersByDate.set(key, (usersByDate.get(key) ?? 0) + 1)
    }

    const generationSparkline: number[] = []
    const userSparkline: number[] = []
    let generationsLast7 = 0
    let generationsPrev7 = 0
    let usersLast7 = 0
    let usersPrev7 = 0

    for (let i = 0; i < 14; i++) {
      const day = new Date(prev7Start)
      day.setUTCDate(prev7Start.getUTCDate() + i)
      const key = toUTCDateKey(day)
      const generationCount = generationByDate.get(key) ?? 0
      const userCount = usersByDate.get(key) ?? 0

      if (i < 7) {
        generationsPrev7 += generationCount
        usersPrev7 += userCount
      } else {
        generationsLast7 += generationCount
        usersLast7 += userCount
        generationSparkline.push(generationCount)
        userSparkline.push(userCount)
      }
    }

    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Number((((current - previous) / previous) * 100).toFixed(1))
    }

    return {
      totalUsers,
      totalProjects,
      totalGenerations: totalGenerationsAgg._sum.count ?? 0,
      activeUsersToday: activeUsersTodayList.length,
      proUserCount,
      userSparkline,
      generationSparkline,
      usersTrend: calcTrend(usersLast7, usersPrev7),
      generationsTrend: calcTrend(generationsLast7, generationsPrev7),
    }
  }),

  getDailyGenerations: adminProcedure
    .input(
      z.object({
        days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const todayMidnightUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      )
      const rangeStart = new Date(todayMidnightUTC)
      rangeStart.setUTCDate(rangeStart.getUTCDate() - (input.days - 1))

      const [logs, baselineAgg] = await Promise.all([
        ctx.prisma.usageLog.findMany({
          where: { createdAt: { gte: rangeStart } },
          select: { createdAt: true, count: true },
        }),
        ctx.prisma.usageLog.aggregate({
          where: { createdAt: { lt: rangeStart } },
          _sum: { count: true },
        }),
      ])

      const toUTCDateKey = (date: Date) => date.toISOString().slice(0, 10)
      const countsByDate = new Map<string, number>()

      for (const log of logs) {
        const key = toUTCDateKey(log.createdAt)
        countsByDate.set(key, (countsByDate.get(key) ?? 0) + log.count)
      }

      const baseline = baselineAgg._sum.count ?? 0
      const chart: Array<{ date: string; count: number }> = []
      let running = baseline
      for (let i = 0; i < input.days; i++) {
        const day = new Date(rangeStart)
        day.setUTCDate(rangeStart.getUTCDate() + i)
        const key = toUTCDateKey(day)
        running += countsByDate.get(key) ?? 0
        chart.push({
          date: key,
          count: running,
        })
      }

      return chart
    }),

  getRecentActivity: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 15

      const logs = await ctx.prisma.usageLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          userId: true,
          type: true,
          count: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      })

      return logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        userName: log.user?.name ?? null,
        userEmail: log.user?.email ?? null,
        type: log.type,
        count: log.count,
        createdAt: log.createdAt,
      }))
    }),
})
