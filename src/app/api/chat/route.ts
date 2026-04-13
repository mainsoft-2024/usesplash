import { consumeStream, convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildSystemPrompt } from "@/lib/chat/system-prompt"
import { generateLogoImage, editLogoImage, withGeminiConcurrency } from "@/lib/gemini"
import { uploadImage, getStorageKey } from "@/lib/storage"

export const maxDuration = 300

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
    messages: await convertToModelMessages(messages, { ignoreIncompleteToolCalls: true }),
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
          let startIndex = (lastLogo?.orderIndex ?? -1) + 1

          // Generate all images in parallel
          const generatePromises = Array.from({ length: count }, (_, i) =>
            withGeminiConcurrency(() => generateLogoImage(prompt, { aspectRatio }))
              .then(result => ({ index: i, result, error: null as string | null }))
              .catch(e => ({ index: i, result: null as any, error: e instanceof Error ? e.message : "Unknown error" }))
          )
          const results = await Promise.all(generatePromises)

          // Save successful results to DB sequentially (to maintain order)
          for (const { index, result, error } of results) {
            if (!result) {
              console.error(`Generation ${index + 1}/${count}: failed -`, error || "null result")
              continue
            }

            try {
              const orderIndex = startIndex + index
              const logo = await prisma.logo.create({
                data: { projectId, orderIndex, prompt, aspectRatio },
              })

              const s3Key = getStorageKey(userId, projectId, logo.id, "v1")
              const imageUrl = await uploadImage(s3Key, result.imageBuffer, result.mimeType)

              await prisma.logoVersion.create({
                data: { logoId: logo.id, versionNumber: 1, imageUrl, s3Key },
              })

              logos.push({ logoId: logo.id, orderIndex, imageUrl })
              console.log(`Generation ${index + 1}/${count}: success, logoId=${logo.id}`)
            } catch (e) {
              console.error(`Generation ${index + 1}/${count} save failed:`, e)
            }
          }

          // Update usage
          if (logos.length > 0) {
            await prisma.subscription.upsert({
              where: { userId },
              update: { dailyGenerations: { increment: logos.length } },
              create: { userId, dailyGenerations: logos.length },
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
          if (!imgRes.ok) {
            return {
              error: `Failed to load logo #${logoOrderIndex} source image (v${sourceVersion.versionNumber}). Please retry.`,
            }
          }
          const sourceBuffer = Buffer.from(await imgRes.arrayBuffer())

          let result: Awaited<ReturnType<typeof editLogoImage>>
          try {
            result = await editLogoImage(editPrompt, sourceBuffer)
          } catch (error) {
            return {
              error: `Image editing failed due to an upstream Gemini error: ${error instanceof Error ? error.message : "Unknown error"}. Please retry in 30 seconds.`,
            }
          }
          if (!result) {
            return {
              error: "Image editing did not return an image. This is usually a temporary provider issue (429/503). Please retry in 30 seconds.",
            }
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
    stopWhen: stepCountIs(3),
    onFinish: async ({ text, steps }) => {
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
    },
  })

  return streamResult.toUIMessageStreamResponse({ consumeSseStream: consumeStream })
}