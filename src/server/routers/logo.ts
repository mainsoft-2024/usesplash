import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "@/lib/trpc/server"
import { validateAndResizeUpload, getStorageKey, uploadImage } from "@/lib/storage"

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
              metadata: true,
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

  uploadBaseImage: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        mimeType: z.string(),
        dataUrl: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      // Verify project ownership
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, userId },
      })
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "프로젝트를 찾을 수 없어요." })

      // Validate + resize (throws TRPCError BAD_REQUEST on failure)
      const { buffer } = await validateAndResizeUpload(input.dataUrl)

      try {
        // Create Logo in a transaction (orderIndex must be atomic)
        const logo = await ctx.prisma.$transaction(async (tx) => {
          const lastLogo = await tx.logo.findFirst({
            where: { projectId: input.projectId },
            orderBy: { orderIndex: "desc" },
          })
          const nextIndex = (lastLogo?.orderIndex ?? -1) + 1
          return tx.logo.create({
            data: {
              projectId: input.projectId,
              orderIndex: nextIndex,
              prompt: "(업로드된 이미지)",
              aspectRatio: "1:1",
            },
          })
        })

        // Upload image outside the transaction (long IO should not hold DB tx open)
        const s3Key = getStorageKey(userId, input.projectId, logo.id, "v1", "webp")
        const { url, bytes } = await uploadImage(s3Key, buffer, "image/webp")

        // Create LogoVersion
        const version = await ctx.prisma.logoVersion.create({
          data: {
            logoId: logo.id,
            versionNumber: 1,
            imageUrl: url,
            s3Key,
            editPrompt: null,
            parentVersionId: null,
          },
        })

        // Record usage (upload is free — no subscription limit check)
        await ctx.prisma.usageLog.create({
          data: {
            userId,
            projectId: input.projectId,
            type: "upload",
            count: 1,
            blobBytes: BigInt(bytes),
          },
        })

        return { logoId: logo.id, versionId: version.id, imageUrl: url, orderIndex: logo.orderIndex }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        console.error("uploadBaseImage failed", err)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "업로드 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요." })
      }
    }),
})