import { convertToModelMessages, streamText, tool, type UIMessage } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildSystemPrompt } from "@/lib/chat/system-prompt"
import { generateLogoImage, editLogoImage } from "@/lib/gemini"
import { uploadImage, getStorageKey } from "@/lib/storage"

export const maxDuration = 120

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  compatibility: "compatible",
})

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4"

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

  const userId = session.user.id
  const systemPrompt = buildSystemPrompt({
    projectName: project.name,
    logoCount: project._count.logos,
  })

  // Save user message to DB
  const lastUserMsg = messages[messages.length - 1]
  if (lastUserMsg?.role === "user") {
    const userText = lastUserMsg.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim()

    if (userText) {
      await prisma.chatMessage.create({
        data: {
          projectId,
          role: "user",
          content: userText,
        },
      })
    }
  }

  const streamResult = streamText({
    model: openrouter(DEFAULT_MODEL),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      generate_batch: tool({
        description: "Generate a batch of logo variations based on the design requirements",
        inputSchema: z.object({
          prompt: z.string().describe("Detailed prompt for logo generation including style, colors, subject"),
          count: z.number().min(1).max(20).default(5).describe("Number of variations to generate"),
          aspectRatio: z.string().default("1:1").describe("Aspect ratio (1:1, 16:9, etc)"),
        }),
        execute: async ({ prompt, count, aspectRatio }) => {
          const logos: Array<{ logoId: string; orderIndex: number; imageUrl: string }> = []

          const lastLogo = await prisma.logo.findFirst({
            where: { projectId },
            orderBy: { orderIndex: "desc" },
          })
          let orderIndex = (lastLogo?.orderIndex ?? -1) + 1

          for (let i = 0; i < count; i++) {
            try {
              const result = await generateLogoImage(prompt, { aspectRatio })
              if (!result) continue

              const logo = await prisma.logo.create({
                data: { projectId, orderIndex: orderIndex++, prompt, aspectRatio },
              })

              const s3Key = getStorageKey(userId, projectId, logo.id, "v1")
              const imageUrl = await uploadImage(s3Key, result.imageBuffer, result.mimeType)

              await prisma.logoVersion.create({
                data: { logoId: logo.id, versionNumber: 1, imageUrl, s3Key },
              })

              logos.push({ logoId: logo.id, orderIndex: logo.orderIndex, imageUrl })
            } catch (e) {
              console.error(`Generation ${i + 1} failed:`, e)
            }

            if (i < count - 1) await new Promise((r) => setTimeout(r, 3000))
          }

          // Update usage
          if (logos.length > 0) {
            await prisma.subscription.upsert({
              where: { userId },
              update: { dailyGenerations: { increment: logos.length } },
              create: { userId, dailyGenerations: logos.length },
            })
          }

          return { generated: logos.length, total: count, logos }
        },
      }),

      edit_logo: tool({
        description: "Edit an existing logo image based on user instructions. Uses the source image as input for editing (not regeneration).",
        inputSchema: z.object({
          logoOrderIndex: z.number().describe("The logo number (1-based display index) to edit"),
          versionNumber: z.number().optional().describe("Specific version number to edit from. If omitted, uses latest version."),
          editPrompt: z.string().describe("Description of the edit to apply"),
        }),
        execute: async ({ logoOrderIndex, versionNumber, editPrompt }) => {
          // Find the logo by order index
          const logo = await prisma.logo.findFirst({
            where: { projectId, orderIndex: logoOrderIndex - 1 },
            include: {
              versions: { orderBy: { versionNumber: "desc" } },
            },
          })
          if (!logo || logo.versions.length === 0) {
            return { error: `Logo #${logoOrderIndex} not found` }
          }

          // Select version
          const sourceVersion = versionNumber
            ? logo.versions.find((v) => v.versionNumber === versionNumber)
            : logo.versions[0] // latest (desc order)
          if (!sourceVersion) {
            return { error: `Version ${versionNumber} not found for logo #${logoOrderIndex}` }
          }

          // Download source image
          const imgRes = await fetch(sourceVersion.imageUrl)
          const sourceBuffer = Buffer.from(await imgRes.arrayBuffer())

          // Edit
          const result = await editLogoImage(editPrompt, sourceBuffer)
          if (!result) {
            return { error: "Image editing failed - try rephrasing the edit request" }
          }

          const nextVersion = (logo.versions[0]?.versionNumber ?? 0) + 1
          const s3Key = getStorageKey(userId, projectId, logo.id, `v${nextVersion}`)
          const imageUrl = await uploadImage(s3Key, result.imageBuffer, result.mimeType)

          const newVersion = await prisma.logoVersion.create({
            data: {
              logoId: logo.id,
              versionNumber: nextVersion,
              parentVersionId: sourceVersion.id,
              imageUrl,
              s3Key,
              editPrompt,
            },
          })

          // Update usage
          await prisma.subscription.upsert({
            where: { userId },
            update: { dailyGenerations: { increment: 1 } },
            create: { userId, dailyGenerations: 1 },
          })

          return {
            logoId: logo.id,
            logoIndex: logoOrderIndex,
            versionId: newVersion.id,
            versionNumber: nextVersion,
            imageUrl,
            editedFrom: sourceVersion.versionNumber,
          }
        },
      }),
    },
    onFinish: async ({ text }) => {
      // Save assistant response to DB
      if (text) {
        await prisma.chatMessage.create({
          data: { projectId, role: "assistant", content: text },
        })
      }
    },
  })

  return streamResult.toUIMessageStreamResponse()
}