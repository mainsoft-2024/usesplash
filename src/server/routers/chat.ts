import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc/server"

export const chatRouter = router({
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, userId: ctx.session.user.id },
      })
      if (!project) throw new Error("Project not found")

      return ctx.prisma.chatMessage.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "asc" },
        include: {
          logoVersions: {
            select: { id: true, imageUrl: true, versionNumber: true },
          },
        },
      })
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, userId: ctx.session.user.id },
      })
      if (!project) throw new Error("Project not found")

      return ctx.prisma.chatMessage.create({
        data: input,
      })
    }),
})