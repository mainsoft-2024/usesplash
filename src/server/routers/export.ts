import sharp from "sharp"
import { z } from "zod"
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
        .trim({ threshold: 240 })
        .toBuffer({ resolveWithObject: true })

      const size = Math.max(trimmed.info.width, trimmed.info.height) + 10
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
      const url = await uploadImage(key, cropped)
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
      const url = await uploadImage(key, resultBuffer)
      return { url, key }
    }),

  vectorize: protectedProcedure
    .input(z.object({ logoVersionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.prisma.logoVersion.findUnique({
        where: { id: input.logoVersionId },
        include: { logo: { include: { project: { select: { userId: true } } } } },
      })

      if (!version || version.logo.project.userId !== ctx.session.user.id) {
        throw new Error("Version not found")
      }

      const apiKey = process.env.RECRAFT_API_KEY
      if (!apiKey) throw new Error("RECRAFT_API_KEY not configured")

      const imgRes = await fetch(version.imageUrl)
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

      const formData = new FormData()
      formData.append("file", new Blob([imgBuffer]), "image.png")

      const res = await fetch(
        "https://external.api.recraft.ai/v1/images/vectorize",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
        },
      )

      if (!res.ok) throw new Error(`Recraft API error: ${res.statusText}`)
      const json = (await res.json()) as { image?: { url?: string } }
      const svgUrl = json.image?.url
      if (!svgUrl) throw new Error("No SVG URL in Recraft response")

      const svgRes = await fetch(svgUrl)
      const svgBuffer = Buffer.from(await svgRes.arrayBuffer())

      const key = getStorageKey(
        ctx.session.user.id,
        version.logo.projectId,
        version.logoId,
        `${version.id}-vector`,
        "svg",
      )
      const url = await uploadImage(key, svgBuffer, "image/svg+xml")
      return { url, key }
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      const url = getDownloadUrl(input.url)
      return { url }
    }),
})