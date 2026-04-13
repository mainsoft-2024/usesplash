import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc/server"

export const projectRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const projects = await ctx.prisma.project.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { logos: true } },
        logos: {
          include: { _count: { select: { versions: true } } },
        },
      },
    })

    return projects.map((p) => ({
      ...p,
      logoCount: p._count.logos,
      revisionCount: p.logos.reduce(
        (sum, l) => sum + Math.max(0, l._count.versions - 1),
        0,
      ),
      logos: undefined,
      _count: undefined,
    }))
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      })
      if (!project) throw new Error("Project not found")
      return project
    }),

  create: protectedProcedure
    .input(
      z.object({ name: z.string().min(1), description: z.string().optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      if (!userId) throw new Error("Unauthorized")
      return ctx.prisma.project.create({
        data: { ...input, userId },
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const project = await ctx.prisma.project.findFirst({
        where: { id, userId: ctx.session.user.id },
      })
      if (!project) throw new Error("Project not found")

      return ctx.prisma.project.update({
        where: { id },
        data,
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      })
      if (!project) throw new Error("Project not found")

      return ctx.prisma.project.delete({
        where: { id: input.id },
      })
    }),
})