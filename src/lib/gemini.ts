import { GoogleGenAI } from "@google/genai"

const VALID_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const
type AspectRatio = (typeof VALID_ASPECT_RATIOS)[number]

const MODEL_NAME = "gemini-3-pro-image-preview"
const MAX_CONCURRENT = 2
let activeCount = 0
const queue: Array<() => void> = []

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not set")
  return new GoogleGenAI({ apiKey })
}

type GeminiLogStatus = "ok" | "retry" | "failed"
type GeminiErrorMeta = { status: number | null; message: string; isRetryable: boolean }

function parseGeminiError(error: unknown): GeminiErrorMeta {
  const status = typeof error === "object" && error !== null && "status" in error ? (error as { status?: number }).status ?? null : null
  const message = error instanceof Error ? error.message : String(error)
  const isRetryable =
    status === 429 ||
    status === 503 ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("UNAVAILABLE")

  return { status, message, isRetryable }
}

async function writeGeminiRequestLog(input: {
  status: GeminiLogStatus
  attempt: number
  latencyMs: number
  httpCode: number | null
  errorMessage?: string
}) {
  try {
    const { prisma } = await import("./prisma")
    await prisma.geminiRequestLog.create({
      data: {
        userId: null,
        projectId: null,
        model: MODEL_NAME,
        status: input.status,
        httpCode: input.httpCode,
        attempt: input.attempt,
        latencyMs: input.latencyMs,
        errorMessage: input.errorMessage,
      },
    })
  } catch (error) {
    console.error("Gemini request log write failed", {
      model: MODEL_NAME,
      status: input.status,
      attempt: input.attempt,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const { isRetryable } = parseGeminiError(error)
      if (!isRetryable || attempt === maxRetries) throw error

      const delay = Math.pow(2, attempt + 1) * 1000
      console.log(`Gemini retry ${attempt + 1}/${maxRetries} after ${delay}ms`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error("Unreachable")
}

export async function withGeminiConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  if (activeCount >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve))
  }

  activeCount++
  try {
    return await fn()
  } finally {
    activeCount--
    if (queue.length > 0) queue.shift()?.()
  }
}

export async function generateLogoImage(
  prompt: string,
  options: {
    aspectRatio?: string
    referenceImages?: Array<{ data: string; mimeType: string }>
  } = {}
): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  const ai = getClient()
  const aspectRatio = VALID_ASPECT_RATIOS.includes(options.aspectRatio as AspectRatio)
    ? options.aspectRatio
    : "1:1"
  const contents = options.referenceImages?.length
    ? [...options.referenceImages.map((referenceImage) => ({ inlineData: { mimeType: referenceImage.mimeType, data: referenceImage.data } })), prompt]
    : prompt
  let attempt = 0

  let response: Awaited<ReturnType<typeof ai.models.generateContent>>
  const maxRetries = 3
  try {
    response = await withRetry(async () => {
      attempt++
      const start = Date.now()
      try {
        const result = await ai.models.generateContent({
          model: MODEL_NAME,
          contents,
          config: {
            responseModalities: ["IMAGE", "TEXT"],
            imageConfig: { aspectRatio: aspectRatio as AspectRatio },
          },
        })
        await writeGeminiRequestLog({
          status: "ok",
          httpCode: null,
          attempt,
          latencyMs: Date.now() - start,
        })
        return result
      } catch (error) {
        const { status, message, isRetryable } = parseGeminiError(error)
        await writeGeminiRequestLog({
          status: isRetryable && attempt <= maxRetries ? "retry" : "failed",
          httpCode: status,
          attempt,
          latencyMs: Date.now() - start,
          errorMessage: message,
        })
        throw error
      } finally {
        console.log(
          JSON.stringify({
            event: "gemini_request",
            model: MODEL_NAME,
            attempt,
            latencyMs: Date.now() - start,
          }),
        )
      }
    }, maxRetries)
  } catch (error) {
    console.error("Gemini generateLogoImage unrecoverable error", {
      model: MODEL_NAME,
      promptLength: prompt.length,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  const candidates = response.candidates
  if (!candidates?.[0]?.content?.parts) {
    console.error("Gemini generateLogoImage missing candidates/content parts", {
      model: MODEL_NAME,
      candidates: response.candidates,
    })
    return null
  }

  for (const part of candidates[0].content.parts) {
    if (part.inlineData?.data) {
      return {
        imageBuffer: Buffer.from(part.inlineData.data, "base64"),
        mimeType: part.inlineData.mimeType ?? "image/png",
      }
    }
  }

  console.error("Gemini generateLogoImage missing inline image data", {
    model: MODEL_NAME,
    parts: candidates[0]?.content?.parts,
  })
  return null
}

export async function editLogoImage(
  prompt: string,
  sourceImageBuffer: Buffer,
  sourceMimeType = "image/png",
  extraReferences?: Array<{ data: string; mimeType: string }>
 ): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  const ai = getClient()
  const base64 = sourceImageBuffer.toString("base64")
  const referenceImages = extraReferences?.slice(0, 3) ?? []
  const contents = [
    { inlineData: { mimeType: sourceMimeType, data: base64 } },
    ...referenceImages.map((referenceImage) => ({ inlineData: { mimeType: referenceImage.mimeType, data: referenceImage.data } })),
    ...(referenceImages.length ? ["Image 1: source to edit. Images 2..N: reference for style/content."] : []),
    prompt,
  ]
  let attempt = 0

  let response: Awaited<ReturnType<typeof ai.models.generateContent>>
  const maxRetries = 3
  try {
    response = await withRetry(async () => {
      attempt++
      const start = Date.now()
      try {
        const result = await ai.models.generateContent({
          model: MODEL_NAME,
          contents,
          config: {
            responseModalities: ["IMAGE", "TEXT"],
          },
        })
        await writeGeminiRequestLog({
          status: "ok",
          httpCode: null,
          attempt,
          latencyMs: Date.now() - start,
        })
        return result
      } catch (error) {
        const { status, message, isRetryable } = parseGeminiError(error)
        await writeGeminiRequestLog({
          status: isRetryable && attempt <= maxRetries ? "retry" : "failed",
          httpCode: status,
          attempt,
          latencyMs: Date.now() - start,
          errorMessage: message,
        })
        throw error
      } finally {
        console.log(
          JSON.stringify({
            event: "gemini_request",
            model: MODEL_NAME,
            attempt,
            latencyMs: Date.now() - start,
          }),
        )
      }
    }, maxRetries)
  } catch (error) {
    console.error("Gemini editLogoImage unrecoverable error", {
      model: MODEL_NAME,
      promptLength: prompt.length,
      sourceMimeType,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  const candidates = response.candidates
  if (!candidates?.[0]?.content?.parts) {
    console.error("Gemini editLogoImage missing candidates/content parts", {
      model: MODEL_NAME,
      candidates: response.candidates,
    })
    return null
  }

  for (const part of candidates[0].content.parts) {
    if (part.inlineData?.data) {
      return {
        imageBuffer: Buffer.from(part.inlineData.data, "base64"),
        mimeType: part.inlineData.mimeType ?? "image/png",
      }
    }
  }

  console.error("Gemini editLogoImage missing inline image data", {
    model: MODEL_NAME,
    parts: candidates[0]?.content?.parts,
  })
  return null
}