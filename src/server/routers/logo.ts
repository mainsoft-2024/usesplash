import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc/server"

export const logoRouter = router({
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, userId: ctx.session.user.id },
      })
      if (!project) throw new Error("Project not found")

      return ctx.prisma.logo.findMany({
        where: { projectId: input.projectId },
        orderBy: { orderIndex: "asc" },
        include: {
          versions: {
            orderBy: { versionNumber: "asc" },
          },
        },
      })
    }),

  getWithVersions: protectedProcedure
    .input(z.object({ logoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const logo = await ctx.prisma.logo.findUnique({
        where: { id: input.logoId },
        include: {
          versions: { orderBy: { versionNumber: "asc" } },
          project: { select: { userId: true } },
        },
      })
      if (!logo || logo.project.userId !== ctx.session.user.id) {
        throw new Error("Logo not found")
      }
      return logo
    }),

  getVersionTree: protectedProcedure
    .input(z.object({ logoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const logo = await ctx.prisma.logo.findUnique({
        where: { id: input.logoId },
        include: {
          versions: {
            orderBy: { versionNumber: "asc" },
            select: {
              id: true,
              versionNumber: true,
              parentVersionId: true,
              imageUrl: true,
              editPrompt: true,
              createdAt: true,
            },
          },
          project: { select: { userId: true } },
        },
      })
      if (!logo || logo.project.userId !== ctx.session.user.id) {
        throw new Error("Logo not found")
      }
      return logo.versions
    }),
})