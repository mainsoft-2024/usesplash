import sharp from "sharp"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { RECRAFT_VECTORIZE_USD, blobCost } from "@/lib/pricing"
import { uploadImage, getDownloadUrl, getStorageKey } from "@/lib/storage"
import { router, protectedProcedure } from "@/lib/trpc/server"

export const exportRouter = router({
  crop: protectedProcedure
    .input(z.object({ logoVersionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.prisma.logoVersion.findUnique({
        where: { id: input.logoVersionId },
        include: { logo: { include: { project: { select: { userId: true } } } } },
      })

      if (!version || version.logo.project.userId !== ctx.session.user.id) {
        throw new Error("Version not found")
      }

      const response = await fetch(version.imageUrl)
      const imageBuffer = Buffer.from(await response.arrayBuffer())

      const trimmed = await sharp(imageBuffer)
        .trim({ background: "#ffffff", threshold: 20 })
        .toBuffer({ resolveWithObject: true })

      const padding = Math.round(Math.max(trimmed.info.width, trimmed.info.height) * 0.06)
      const size = Math.max(trimmed.info.width, trimmed.info.height) + padding * 2
      const cropped = await sharp({
        create: {
          width: size,
          height: size,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([
          {
            input: trimmed.data,
            gravity: "center",
          },
        ])
        .png()
        .toBuffer()

      const key = getStorageKey(
        ctx.session.user.id,
        version.logo.projectId,
        version.logoId,
        `${version.id}-cropped`,
        "png",
      )
      const { url, bytes: _bytes } = await uploadImage(key, cropped)
      return { url, key }
    }),

  removeBg: protectedProcedure
    .input(z.object({ logoVersionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.prisma.logoVersion.findUnique({
        where: { id: input.logoVersionId },
        include: { logo: { include: { project: { select: { userId: true } } } } },
      })

      if (!version || version.logo.project.userId !== ctx.session.user.id) {
        throw new Error("Version not found")
      }

      const apiKey = process.env.REMOVE_BG_API_KEY
      if (!apiKey) throw new Error("REMOVE_BG_API_KEY not configured")

      const imgRes = await fetch(version.imageUrl)
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

      const formData = new FormData()
      formData.append("image_file", new Blob([imgBuffer]), "image.png")
      formData.append("size", "auto")
      formData.append("format", "png")

      const res = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": apiKey },
        body: formData,
      })

      if (!res.ok) throw new Error(`remove.bg API error: ${res.statusText}`)
      const resultBuffer = Buffer.from(await res.arrayBuffer())

      const key = getStorageKey(
        ctx.session.user.id,
        version.logo.projectId,
        version.logoId,
        `${version.id}-nobg`,
        "png",
      )
      const { url, bytes: _bytes } = await uploadImage(key, resultBuffer)
      return { url, key }
    }),

  vectorize: protectedProcedure
    .input(z.object({ logoVersionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.prisma.logoVersion.findUnique({
        where: { id: input.logoVersionId },
        include: { logo: { include: { project: { select: { userId: true } } } } },
      })

      if (!version) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" })
      }
      if (version.logo.project.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" })
      }

      if (version.svgUrl) {
        return {
          url: version.svgUrl,
          key: version.s3Key.replace(/\.png$/, ".svg"),
          cached: true,
        }
      }

      const callRecraftVectorize = async ({
        buffer,
        meta,
      }: {
        buffer: Buffer
        meta: { userId: string; projectId: string; logoId: string; versionId: string }
      }): Promise<{ image?: { url?: string } }> => {
        const apiKey = process.env.RECRAFT_API_KEY
        if (!apiKey) throw new Error("RECRAFT_API_KEY not configured")

        for (let attempt = 1; attempt <= 3; attempt += 1) {
          const start = Date.now()
          const formData = new FormData()
          formData.append("file", new Blob([new Uint8Array(buffer)]), "image.png")

          const res = await fetch("https://external.api.recraft.ai/v1/images/vectorize", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData,
          })
          const latencyMs = Date.now() - start

          if (res.ok) {
            await ctx.prisma.recraftRequestLog.create({
              data: {
                userId: meta.userId,
                projectId: meta.projectId,
                logoId: meta.logoId,
                versionId: meta.versionId,
                model: "vectorize",
                status: "ok",
                httpCode: res.status,
                attempt,
                latencyMs,
              },
            })
            return (await res.json()) as { image?: { url?: string } }
          }

          if (res.status === 429 || res.status >= 500) {
            const retryLog = await ctx.prisma.recraftRequestLog.create({
              data: {
                userId: meta.userId,
                projectId: meta.projectId,
                logoId: meta.logoId,
                versionId: meta.versionId,
                model: "vectorize",
                status: "retry",
                httpCode: res.status,
                attempt,
                latencyMs,
                errorMessage: res.statusText,
              },
            })

            if (attempt === 3) {
              await ctx.prisma.recraftRequestLog.update({
                where: { id: retryLog.id },
                data: { status: "error" },
              })
              throw new Error(`Recraft API error: ${res.status} ${res.statusText}`)
            }

            await new Promise((resolve) =>
              setTimeout(resolve, 2000 * 2 ** (attempt - 1)),
            )
            continue
          }

          await ctx.prisma.recraftRequestLog.create({
            data: {
              userId: meta.userId,
              projectId: meta.projectId,
              logoId: meta.logoId,
              versionId: meta.versionId,
              model: "vectorize",
              status: "error",
              httpCode: res.status,
              attempt,
              latencyMs,
              errorMessage: res.statusText,
            },
          })
          throw new Error(`Recraft API error: ${res.status} ${res.statusText}`)
        }

        throw new Error("Recraft API error")
      }

      try {
        const imgRes = await fetch(version.imageUrl)
        if (!imgRes.ok) throw new Error("Failed to fetch source image")
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

        const vectorized = await callRecraftVectorize({
          buffer: imgBuffer,
          meta: {
            userId: ctx.session.user.id,
            projectId: version.logo.projectId,
            logoId: version.logoId,
            versionId: version.id,
          },
        })

        const svgUrl = vectorized.image?.url
        if (!svgUrl) throw new Error("No SVG URL in Recraft response")

        const svgRes = await fetch(svgUrl)
        if (!svgRes.ok) throw new Error("Failed to fetch vectorized SVG")
        const svgBuffer = Buffer.from(await svgRes.arrayBuffer())

        const key = getStorageKey(
          ctx.session.user.id,
          version.logo.projectId,
          version.logoId,
          version.id,
          "svg",
        )
        const { url, bytes } = await uploadImage(key, svgBuffer, "image/svg+xml")

        await ctx.prisma.$transaction([
          ctx.prisma.logoVersion.update({
            where: { id: version.id },
            data: { svgUrl: url },
          }),
          ctx.prisma.usageLog.create({
            data: {
              userId: ctx.session.user.id,
              projectId: version.logo.projectId,
              type: "vectorize",
              count: 1,
              imageCount: 1,
              model: "vectorize",
              imageCostUsd: RECRAFT_VECTORIZE_USD,
              blobBytes: BigInt(bytes),
              blobCostUsd: blobCost(bytes),
            },
          }),
        ])

        return { url, key, cached: false }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "SVG 변환에 실패했습니다.",
        })
      }
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      const url = getDownloadUrl(input.url)
      return { url }
    }),
})