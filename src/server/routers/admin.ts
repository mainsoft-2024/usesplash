import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { protectedProcedure, router } from "@/lib/trpc/server"

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const dbUser = await ctx.prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { role: true },
  })

  if (!dbUser || dbUser.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." })
  }

  return next()
})

export const adminRouter = router({
  listUsers: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const page = Math.max(input.page, 1)
      const pageSize = Math.max(input.pageSize, 1)
      const skip = (page - 1) * pageSize

      const where = input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { email: { contains: input.search, mode: "insensitive" as const } },
            ],
          }
        : undefined

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

      const generationGroups = userIds.length
        ? await ctx.prisma.usageLog.groupBy({
            by: ["userId"],
            where: { userId: { in: userIds } },
            _sum: { count: true },
          })
        : []

      const generationMap = new Map(generationGroups.map((item) => [item.userId, item._sum.count ?? 0]))

      return {
        users: users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          joinedAt: user.createdAt,
          projectCount: user._count.projects,
          tier: user.subscription?.tier ?? "free",
          totalGenerations: generationMap.get(user.id) ?? 0,
        })),
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

    const [totalUsers, totalProjects, totalGenerationsAgg, activeUsersTodayList] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.project.count(),
      ctx.prisma.usageLog.aggregate({ _sum: { count: true } }),
      ctx.prisma.usageLog.findMany({
        where: { createdAt: { gte: todayMidnightUTC } },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ])

    return {
      totalUsers,
      totalProjects,
      totalGenerations: totalGenerationsAgg._sum.count ?? 0,
      activeUsersToday: activeUsersTodayList.length,
    }
  }),
})
