import { consumeStream, convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildSystemPrompt } from "@/lib/chat/system-prompt"
import { limitImagesPerTurn, reorderPartsTextFirst } from "@/lib/chat/vision-utils"
import { editLogoImage, generateLogoImage, withGeminiConcurrency } from "@/lib/gemini"
import { uploadImage, getStorageKey, resizeAndUploadImage } from "@/lib/storage"
import {
  extractMentionParts,
  MentionValidationError,
  renderMentionedVersionsForPrompt,
  validateMentions,
  fetchImageBufferFromUrl,
} from "./mentions"
import { runEditLogo } from "./edit-logo"
import { TIER_LIMITS } from "@/server/routers/subscription"
import { blobCost, imageCost, llmCost } from "@/lib/pricing"

export const maxDuration = 300

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  compatibility: "compatible",
})

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-3-flash-preview"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = await req.json()
  const { messages, projectId } = body as {
    messages: UIMessage[]
    projectId: string
  }

  if (!projectId) {
    return new Response("projectId required", { status: 400 })
  }

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { _count: { select: { logos: true } } },
  })
  if (!project) {
    return new Response("Project not found", { status: 404 })
  }

  // Daily generation limit check
  let sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  })
  if (!sub) {
    sub = await prisma.subscription.create({
      data: { userId: session.user.id },
    })
  }
  if (new Date() > sub.dailyResetAt) {
    const tomorrow = new Date()
    tomorrow.setUTCHours(0, 0, 0, 0)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    sub = await prisma.subscription.update({
      where: { id: sub.id },
      data: { dailyGenerations: 0, dailyResetAt: tomorrow },
    })
  }
  const limits = TIER_LIMITS[sub.tier as keyof typeof TIER_LIMITS] ?? TIER_LIMITS.free
  const remaining =
    limits.dailyGenerations === -1
      ? Infinity
      : limits.dailyGenerations - sub.dailyGenerations
  if (remaining <= 0) {
    return new Response(
      JSON.stringify({
        error: "DAILY_LIMIT_REACHED",
        message: "일일 생성 한도를 초과했습니다. 내일 다시 시도해주세요.",
        remaining: 0,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    )
  }

  const userId = session.user.id
  const lastUserMsg = messages[messages.length - 1]
  let mentionedSection = ""
  let mentionedVersions: Array<{ imageUrl: string }> = []

  if (lastUserMsg?.role === "user") {
    for (const part of lastUserMsg.parts ?? []) {
      if (part.type !== "file") continue
      const filePart = part as { type: "file"; url?: string; mediaType?: string }
      if (!filePart.url?.startsWith("data:")) continue

      try {
        const { url, mediaType, bytes: _attachmentBytes } = await resizeAndUploadImage(
          filePart.url,
          projectId,
          userId
        )
        filePart.url = url
        filePart.mediaType = mediaType
      } catch (error) {
        console.error("Failed to upload attachment image", {
          projectId,
          userId,
          error,
        })
      }
    }

    const mentions = extractMentionParts(lastUserMsg)
    if (mentions.length > 0) {
      try {
        const versions = await validateMentions(mentions, projectId, prisma)
        mentionedVersions = versions
        const mentionFileParts = versions.map((version) => ({
          type: "file" as const,
          mediaType: "image/png",
          url: version.imageUrl,
        }))
        lastUserMsg.parts = [...(lastUserMsg.parts ?? []), ...mentionFileParts]
        mentionedSection = renderMentionedVersionsForPrompt(versions)
      } catch (error) {
        if (error instanceof MentionValidationError) {
          return Response.json(
            { error: "mention_invalid", missingVersionIds: error.missingVersionIds },
            { status: 400 }
          )
        }
        throw error
      }
    }
  }

  const autoReferenceUrls: string[] = []
  let recentUserTurns = 0
  for (let i = messages.length - 1; i >= 0 && recentUserTurns < 2; i--) {
    const message = messages[i]
    if (message.role !== "user") continue
    recentUserTurns += 1
    for (const part of message.parts ?? []) {
      if (part.type !== "file") continue
      const fileUrl = (part as { url?: string }).url
      if (typeof fileUrl !== "string" || !fileUrl.startsWith("https://")) continue
      if (!autoReferenceUrls.includes(fileUrl)) autoReferenceUrls.push(fileUrl)
    }
  }

  const systemPrompt = buildSystemPrompt({
    projectName: project.name,
    logoCount: project._count.logos,
    mentionedSection,
  } as { projectName?: string; logoCount?: number; mentionedSection?: string })

  // Save user message to DB
  if (lastUserMsg?.role === "user") {
    const userText = lastUserMsg.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim()

    const hasFileParts = lastUserMsg.parts?.some((p: any) => p.type === "file")

    if (userText || hasFileParts) {
      await prisma.chatMessage.create({
        data: {
          projectId,
          role: "user",
          content: userText || "(이미지 첨부)",
          parts: hasFileParts ? JSON.parse(JSON.stringify(lastUserMsg.parts)) : undefined,
        },
      })
    }
  }

  const allowedReferenceUrls = new Set<string>()
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (part.type !== "file") continue
      const fileUrl = (part as { url?: string }).url
      if (typeof fileUrl === "string" && fileUrl.startsWith("https://")) {
        allowedReferenceUrls.add(fileUrl)
      }
    }
  }

  const latestViewLogoUrls: string[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== "assistant") continue

    for (const part of message.parts ?? []) {
      if (part.type !== "tool-view_logo") continue
      const toolPart = part as { state?: string; output?: { imageUrl?: unknown } }
      if (toolPart.state !== "output-available") continue

      const imageUrl = toolPart.output?.imageUrl
      if (typeof imageUrl === "string" && imageUrl.startsWith("https://")) {
        latestViewLogoUrls.push(imageUrl)
      }
    }

    if (latestViewLogoUrls.length > 0) break
  }
  for (const imageUrl of latestViewLogoUrls) {
    allowedReferenceUrls.add(imageUrl)
  }
  for (const version of mentionedVersions) {
    allowedReferenceUrls.add(version.imageUrl)
  }

  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")
  const latestUserAttachmentUrls = (lastUserMessage?.parts ?? [])
    .filter((part) => part.type === "file")
    .map((part) => (part as { url?: string }).url)
    .filter((url): url is string => typeof url === "string" && url.startsWith("https://"))

  const llmMessages = limitImagesPerTurn(messages, 5).map((message) => {
    if (message.role !== "user") return message
    return { ...message, parts: reorderPartsTextFirst(message.parts ?? []) }
  })

  const streamResult = streamText({
    model: openrouter(DEFAULT_MODEL),
    system: systemPrompt,
    messages: await convertToModelMessages(llmMessages, { ignoreIncompleteToolCalls: true }),
    tools: {
      generate_batch: tool({
        description: "Generate a batch of logo variations based on the design requirements",
        inputSchema: z.object({
          prompt: z.string().describe("Detailed prompt for logo generation including style, colors, subject"),
          count: z.number().min(1).max(20).default(5).describe("Number of variations to generate"),
          aspectRatio: z.string().default("1:1").describe("Aspect ratio (1:1, 16:9, etc)"),
          referenceImageUrls: z
            .array(z.string().url())
            .max(5)
            .optional()
            .describe("Blob URLs of reference images from user attachments or gallery logos"),
        }),
        execute: async ({ prompt, count, aspectRatio, referenceImageUrls }) => {
          const logos: Array<{ logoId: string; orderIndex: number; imageUrl: string }> = []
          let totalBlobBytes = 0
          // Re-check limit before generation
          let sub = await prisma.subscription.findUnique({
            where: { userId },
          })
          if (sub) {
            if (new Date() > sub.dailyResetAt) {
              const tomorrow = new Date()
              tomorrow.setUTCHours(0, 0, 0, 0)
              tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
              sub = await prisma.subscription.update({
                where: { id: sub.id },
                data: { dailyGenerations: 0, dailyResetAt: tomorrow },
              })
            }
            const limits = TIER_LIMITS[sub.tier as keyof typeof TIER_LIMITS] ?? TIER_LIMITS.free
            if (limits.dailyGenerations !== -1 && sub.dailyGenerations + count > limits.dailyGenerations) {
              return {
                error: "Daily generation limit reached. Try again tomorrow.",
                generated: 0,
                total: count,
                logos: [],
              }
            }
          }

          let referenceImages: Array<{ data: string; mimeType: string }> | undefined
          const requestedRefUrls = referenceImageUrls ?? []
          const rejected = requestedRefUrls.filter((url) => !allowedReferenceUrls.has(url))
          if (rejected.length > 0) {
            console.warn("Rejected unknown referenceImageUrls", {
              projectId,
              userId,
              rejected,
            })
          }

          let effectiveRefUrls = requestedRefUrls.filter((url) => allowedReferenceUrls.has(url))
          if (effectiveRefUrls.length === 0 && latestUserAttachmentUrls.length > 0) {
            effectiveRefUrls = [...latestUserAttachmentUrls]
            console.log("Auto-injected latest user attachment URLs for generate_batch", {
              projectId,
              userId,
              autoInjected: latestUserAttachmentUrls,
            })
          }

          if (effectiveRefUrls.length > 0) {
            try {
              referenceImages = await Promise.all(
                effectiveRefUrls.map(async (url) => {
                  const response = await fetch(url)
                  if (!response.ok) {
                    throw new Error(`Failed to load reference image: ${url}`)
                  }
                  const mimeType = response.headers.get("content-type") ?? "image/webp"
                  const data = Buffer.from(await response.arrayBuffer()).toString("base64")
                  return { data, mimeType }
                })
              )
            } catch (error) {
              return {
                error: `Failed to load reference images: ${error instanceof Error ? error.message : "Unknown error"}`,
                generated: 0,
                total: count,
                logos: [],
              }
            }
          }

          for (let i = 0; i < count; i++) {
            try {
              const result = await withGeminiConcurrency(() =>
                generateLogoImage(prompt, { aspectRatio, referenceImages })
              )
              if (!result) {
                console.error(`Generation ${i + 1}/${count}: failed - null result`)
                continue
              }

              const logo = await prisma.$transaction(async (tx) => {
                const lastLogo = await tx.logo.findFirst({
                  where: { projectId },
                  orderBy: { orderIndex: "desc" },
                })
                const orderIndex = (lastLogo?.orderIndex ?? -1) + 1
                return tx.logo.create({
                  data: { projectId, orderIndex, prompt, aspectRatio },
                })
              })

              const s3Key = getStorageKey(userId, projectId, logo.id, "v1")
              const { url: imageUrl, bytes } = await uploadImage(
                s3Key,
                result.imageBuffer,
                result.mimeType
              )
              totalBlobBytes += bytes

              await prisma.logoVersion.create({
                data: { logoId: logo.id, versionNumber: 1, imageUrl, s3Key },
              })

              logos.push({ logoId: logo.id, orderIndex: logo.orderIndex, imageUrl })
              console.log(`Generation ${i + 1}/${count}: success, logoId=${logo.id}`)
            } catch (e) {
              console.error(`Generation ${i + 1}/${count} failed:`, e)
            }
          }

          // Update usage
          if (logos.length > 0) {
            await prisma.subscription.upsert({
              where: { userId },
              update: { dailyGenerations: { increment: logos.length } },
              create: { userId, dailyGenerations: logos.length },
            })
            await prisma.usageLog.create({
              data: {
                userId,
                projectId,
                type: "generate",
                count: logos.length,
                model: "gemini-3-pro-image-preview",
                imageCount: logos.length,
                imageCostUsd: imageCost(logos.length),
                blobBytes: totalBlobBytes,
                blobCostUsd: blobCost(totalBlobBytes),
              },
            })
          }

          if (logos.length === count) {
            return { generated: logos.length, total: count, logos }
          }

          if (logos.length === 0) {
            return {
              generated: 0,
              total: count,
              logos,
              error: `Failed to generate logos (0/${count}). The image service is temporarily unavailable. Please retry in a moment.`,
            }
          }

          return {
            generated: logos.length,
            total: count,
            logos,
            error: `Generated ${logos.length}/${count} logos. ${count - logos.length} failed due to temporary image API limits. Retry to generate the remaining logos.`,
          }
        },
      }),

      edit_logo: tool({
        description: "Edit an existing logo image. Pass the versionId (NOT logoId) from data-mention parts in referencedVersions. The server will auto-include images from the user's last two message turns as additional references.",
        inputSchema: z.object({
          logoOrderIndex: z.number().optional().describe("The logo number (1-based display index) to edit"),
          versionNumber: z.number().optional().describe("Specific version number to edit from. If omitted, uses latest version."),
          editPrompt: z.string().describe("Description of the edit to apply"),
          referencedVersions: z.array(z.string()).max(3).optional().describe("Mentioned logoVersion IDs to use as references"),
          referenceImageUrls: z
            .array(z.string().url())
            .max(3)
            .optional()
            .describe(
              "Absolute https URLs of reference images to send to the image model in addition to referencedVersions. The server will automatically merge the latest 2 user-turn file images; only pass extra URLs here if the user explicitly pointed to a different image."
            ),
          outputMode: z
            .enum(["new_version", "new_logo"])
            .optional()
            .describe("new_version edits an existing logo, new_logo creates a new logo entry"),
        }),
        execute: async ({ logoOrderIndex, versionNumber, editPrompt, referencedVersions, referenceImageUrls, outputMode }) => {
          // Re-check limit before edit
          let sub = await prisma.subscription.findUnique({
            where: { userId },
          })
          if (sub) {
            if (new Date() > sub.dailyResetAt) {
              const tomorrow = new Date()
              tomorrow.setUTCHours(0, 0, 0, 0)
              tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
              sub = await prisma.subscription.update({
                where: { id: sub.id },
                data: { dailyGenerations: 0, dailyResetAt: tomorrow },
              })
            }
            const limits = TIER_LIMITS[sub.tier as keyof typeof TIER_LIMITS] ?? TIER_LIMITS.free
            if (limits.dailyGenerations !== -1 && sub.dailyGenerations + 1 > limits.dailyGenerations) {
              return { error: "Daily generation limit reached. Try again tomorrow." }
            }
          }

          const mergedReferenceUrls: string[] = []
          for (const imageUrl of referenceImageUrls ?? []) {
            if (!mergedReferenceUrls.includes(imageUrl)) mergedReferenceUrls.push(imageUrl)
          }
          for (const imageUrl of autoReferenceUrls) {
            if (!mergedReferenceUrls.includes(imageUrl)) mergedReferenceUrls.push(imageUrl)
          }
          const cappedReferenceUrls = mergedReferenceUrls.slice(0, 3)
          for (const imageUrl of cappedReferenceUrls) {
            allowedReferenceUrls.add(imageUrl)
          }

          const result = await runEditLogo(
            {
              logoOrderIndex,
              versionNumber,
              editPrompt,
              referencedVersions,
              outputMode,
              referenceImageUrls: cappedReferenceUrls,
            },
            {
              prisma,
              projectId,
              userId,
              editLogoImage,
              fetchImageBufferFromUrl,
              uploadImage,
              getStorageKey,
            }
          )

          if ("error" in result) {
            return result
          }

          // Update usage
          await prisma.subscription.upsert({
            where: { userId },
            update: { dailyGenerations: { increment: 1 } },
            create: { userId, dailyGenerations: 1 },
          })
          await prisma.usageLog.create({
            data: {
              userId,
              projectId,
              type: "edit",
              count: 1,
              model: "gemini-3-pro-image-preview",
              imageCount: 1,
              imageCostUsd: imageCost(1),
              blobBytes: result.blobBytes,
              blobCostUsd: blobCost(result.blobBytes),
            },
          })

          return {
            logoId: result.logoId,
            logoIndex: result.logoIndex,
            versionId: result.versionId,
            versionNumber: result.versionNumber,
            imageUrl: result.imageUrl,
            editedFrom: result.editedFrom,
          }
        },
      }),

      view_logo: tool({
        description: "View a specific logo/version from gallery for visual analysis",
        inputSchema: z.object({
          logoOrderIndex: z.number().int().min(1),
          versionNumber: z.number().int().min(1).optional(),
        }),
        execute: async ({ logoOrderIndex, versionNumber }) => {
          const logo = await prisma.logo.findFirst({
            where: { projectId, orderIndex: logoOrderIndex - 1 },
            include: {
              versions: { orderBy: { versionNumber: "desc" } },
            },
          })

          if (!logo || logo.versions.length === 0) {
            return [{ type: "text", text: `Logo #${logoOrderIndex} not found` }]
          }

          const selectedVersion = versionNumber
            ? logo.versions.find((version) => version.versionNumber === versionNumber)
            : logo.versions[0]

          if (!selectedVersion) {
            return [
              {
                type: "text",
                text: `Version ${versionNumber} not found for logo #${logoOrderIndex}`,
              },
            ]
          }

          const result = {
            logoIndex: logoOrderIndex,
            versionNumber: selectedVersion.versionNumber,
            imageUrl: selectedVersion.imageUrl,
            createdAt: selectedVersion.createdAt,
            versionCount: logo.versions.length,
            aspectRatio: logo.aspectRatio,
          }

          return [
            {
              type: "text",
              text: `Logo #${result.logoIndex} v${result.versionNumber} (${result.aspectRatio}) created ${result.createdAt.toISOString()} — ${result.versionCount} versions total`,
            },
            { type: "image", image: new URL(result.imageUrl) },
          ]
        },
      }),
    },
    stopWhen: stepCountIs(3),
    onFinish: async ({ text, steps, usage }) => {
      const parts: any[] = []
      for (const step of steps) {
        if (step.text) parts.push({ type: "text", text: step.text })
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            const tr = step.toolResults?.find((r: any) => r.toolCallId === tc.toolCallId)
            parts.push({
              type: `tool-${tc.toolName}`,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              state: tr ? "output-available" : "output-error",
              input: (tc as any).args ?? (tc as any).input,
              output: (tr as any)?.result ?? (tr as any)?.output,
            })
          }
        }
      }
      if (parts.length > 0 || text) {
        await prisma.chatMessage.create({
          data: {
            projectId,
            role: "assistant",
            content: text || "",
            parts: parts.length > 0 ? parts : undefined,
          },
        })
      }
      const llmInputTokens = usage?.inputTokens ?? null
      const llmOutputTokens = usage?.outputTokens ?? null
      const llmCostUsd =
        usage?.inputTokens != null && usage?.outputTokens != null
          ? llmCost(usage.inputTokens, usage.outputTokens)
          : null
      await prisma.usageLog.create({
        data: {
          userId,
          projectId,
          type: "llm",
          count: 1,
          model: DEFAULT_MODEL,
          llmInputTokens,
          llmOutputTokens,
          llmCostUsd,
        },
      })
    },
  })

  return streamResult.toUIMessageStreamResponse({ consumeSseStream: consumeStream })
}