import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc/server"
import { generateLogoImage, editLogoImage } from "@/lib/gemini"
import { uploadImage, getStorageKey } from "@/lib/storage"
import { TRPCError } from "@trpc/server"

export const generationRouter = router({
  generateBatch: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        prompt: z.string(),
        count: z.number().int().min(1).max(20).default(8),
        aspectRatio: z.string().default("1:1"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })
      // Verify project ownership
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, userId },
      })
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" })

      // Check subscription limits
      const sub = await ctx.prisma.subscription.findUnique({
        where: { userId },
      })
      const tier = sub?.tier ?? "free"
      const LIMITS: Record<string, number> = { free: 10, pro: 100, enterprise: -1 }
      const limit = LIMITS[tier] ?? 10
      if (limit !== -1 && (sub?.dailyGenerations ?? 0) + input.count > limit) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Daily generation limit reached" })
      }

      // Get current max orderIndex
      const lastLogo = await ctx.prisma.logo.findFirst({
        where: { projectId: input.projectId },
        orderBy: { orderIndex: "desc" },
      })
      let orderIndex = (lastLogo?.orderIndex ?? -1) + 1

      const generatedLogos: Array<{ logoId: string; versionId: string; imageUrl: string; orderIndex: number }> = []

      for (let i = 0; i < input.count; i++) {
        try {
          const result = await generateLogoImage(input.prompt, { aspectRatio: input.aspectRatio })
          if (!result) continue

          // Create logo + version in DB
          const logo = await ctx.prisma.logo.create({
            data: {
              projectId: input.projectId,
              orderIndex: orderIndex++,
              prompt: input.prompt,
              aspectRatio: input.aspectRatio,
            },
          })

          const s3Key = getStorageKey(userId, input.projectId, logo.id, "v1")
          const imageUrl = await uploadImage(s3Key, result.imageBuffer, result.mimeType)

          const version = await ctx.prisma.logoVersion.create({
            data: {
              logoId: logo.id,
              versionNumber: 1,
              imageUrl,
              s3Key,
            },
          })

          generatedLogos.push({
            logoId: logo.id,
            versionId: version.id,
            imageUrl,
            orderIndex: logo.orderIndex,
          })
        } catch (e) {
          console.error(`Generation ${i + 1} failed:`, e)
        }

        // Delay between generations
        if (i < input.count - 1) {
          await new Promise((r) => setTimeout(r, 3000))
        }
      }

      // Update usage
      if (generatedLogos.length > 0) {
        await ctx.prisma.subscription.upsert({
          where: { userId },
          update: { dailyGenerations: { increment: generatedLogos.length } },
          create: { userId, dailyGenerations: generatedLogos.length },
        })
      }

      return { generated: generatedLogos.length, logos: generatedLogos }
    }),

  editLogo: protectedProcedure
    .input(
      z.object({
        logoVersionId: z.string(),
        prompt: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })
      const sourceVersion = await ctx.prisma.logoVersion.findUnique({
        where: { id: input.logoVersionId },
        include: { logo: { include: { project: { select: { userId: true } } } } },
      })
      if (!sourceVersion || sourceVersion.logo.project.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" })
      }

      // Download source image
      const imgRes = await fetch(sourceVersion.imageUrl)
      const sourceBuffer = Buffer.from(await imgRes.arrayBuffer())

      // Edit via Gemini
      const result = await editLogoImage(input.prompt, sourceBuffer)
      if (!result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Image editing failed" })
      }

      // Get next version number
      const maxVersion = await ctx.prisma.logoVersion.findFirst({
        where: { logoId: sourceVersion.logoId },
        orderBy: { versionNumber: "desc" },
      })
      const nextVersion = (maxVersion?.versionNumber ?? 0) + 1

      // Upload and create version
      const s3Key = getStorageKey(
        userId,
        sourceVersion.logo.projectId,
        sourceVersion.logoId,
        `v${nextVersion}`
      )
      const imageUrl = await uploadImage(s3Key, result.imageBuffer, result.mimeType)

      const newVersion = await ctx.prisma.logoVersion.create({
        data: {
          logoId: sourceVersion.logoId,
          versionNumber: nextVersion,
          parentVersionId: sourceVersion.id,
          imageUrl,
          s3Key,
          editPrompt: input.prompt,
        },
      })

      // Update usage
      await ctx.prisma.subscription.upsert({
        where: { userId },
        update: { dailyGenerations: { increment: 1 } },
        create: { userId, dailyGenerations: 1 },
      })

      return {
        versionId: newVersion.id,
        imageUrl,
        versionNumber: nextVersion,
        logoId: sourceVersion.logoId,
      }
    }),
})