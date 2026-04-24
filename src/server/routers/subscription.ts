import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "@/lib/trpc/server"

const TIER_LIMITS = {
  free: { maxProjects: 3, dailyGenerations: 10, monthlyVectorizes: 5, premiumExport: false },
  pro: { maxProjects: -1, dailyGenerations: 100, monthlyVectorizes: 100, premiumExport: true },
  demo: { maxProjects: -1, dailyGenerations: -1, monthlyVectorizes: -1, premiumExport: true },
  enterprise: { maxProjects: -1, dailyGenerations: -1, monthlyVectorizes: -1, premiumExport: true },
} as const

export const subscriptionRouter = router({
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })
    let sub = await ctx.prisma.subscription.findUnique({
      where: { userId }
    })

    if (!sub) {
      sub = await ctx.prisma.subscription.create({
        data: { userId }
      })
    }

    const limits =
      TIER_LIMITS[sub.tier as keyof typeof TIER_LIMITS] ?? TIER_LIMITS.free
    return { ...sub, limits }
  }),

  checkGenerationLimit: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })
    let sub = await ctx.prisma.subscription.findUnique({
      where: { userId }
    })

    if (!sub) {
      sub = await ctx.prisma.subscription.create({
        data: { userId }
      })
    }

    if (new Date() > sub.dailyResetAt) {
      const tomorrow = new Date()
      tomorrow.setUTCHours(0, 0, 0, 0)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      sub = await ctx.prisma.subscription.update({
        where: { id: sub.id },
        data: { dailyGenerations: 0, dailyResetAt: tomorrow },
      })
    }

    const limits =
      TIER_LIMITS[sub.tier as keyof typeof TIER_LIMITS] ?? TIER_LIMITS.free
    const remaining =
      limits.dailyGenerations === -1
        ? Infinity
        : limits.dailyGenerations - sub.dailyGenerations

    return { allowed: remaining > 0, remaining, tier: sub.tier, limits }
  }),

  incrementUsage: protectedProcedure
    .input(z.object({ count: z.number().int().positive().default(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })
      let sub = await ctx.prisma.subscription.findUnique({
        where: { userId }
      })

      if (!sub) {
        sub = await ctx.prisma.subscription.create({
          data: { userId }
        })
      }

      return ctx.prisma.subscription.update({
        where: { id: sub.id },
        data: { dailyGenerations: { increment: input.count } },
      })
    }),

  adminUpdateTier: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        tier: z.enum(["free", "pro", "demo", "enterprise"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      })

      if (user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" })
      }

      return ctx.prisma.subscription.upsert({
        where: { userId: input.userId },
        update: { tier: input.tier },
        create: { userId: input.userId, tier: input.tier },
      })
    }),
})

export { TIER_LIMITS }