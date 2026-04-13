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

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error ? (error as { status?: number }).status : undefined
      const message = error instanceof Error ? error.message : String(error)
      const isRetryable =
        status === 429 ||
        status === 503 ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.includes("UNAVAILABLE")

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
  options: { aspectRatio?: string } = {}
): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  const ai = getClient()
  const aspectRatio = VALID_ASPECT_RATIOS.includes(options.aspectRatio as AspectRatio)
    ? options.aspectRatio
    : "1:1"
  let attempt = 0

  let response: Awaited<ReturnType<typeof ai.models.generateContent>>
  try {
    response = await withRetry(async () => {
      attempt++
      const start = Date.now()
      try {
        return await ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            responseModalities: ["IMAGE", "TEXT"],
            imageConfig: { aspectRatio: aspectRatio as AspectRatio },
          },
        })
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
    })
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
  sourceMimeType = "image/png"
): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  const ai = getClient()
  const base64 = sourceImageBuffer.toString("base64")
  let attempt = 0

  let response: Awaited<ReturnType<typeof ai.models.generateContent>>
  try {
    response = await withRetry(async () => {
      attempt++
      const start = Date.now()
      try {
        return await ai.models.generateContent({
          model: MODEL_NAME,
          contents: [
            { inlineData: { mimeType: sourceMimeType, data: base64 } },
            prompt,
          ],
          config: {
            responseModalities: ["IMAGE", "TEXT"],
          },
        })
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
    })
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