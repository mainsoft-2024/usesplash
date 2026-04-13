import { GoogleGenAI } from "@google/genai"

const VALID_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const
type AspectRatio = (typeof VALID_ASPECT_RATIOS)[number]

const MODEL_NAME = "gemini-2.0-flash-preview-image-generation"

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not set")
  return new GoogleGenAI({ apiKey })
}

export async function generateLogoImage(
  prompt: string,
  options: { aspectRatio?: string } = {}
): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  const ai = getClient()
  const aspectRatio = VALID_ASPECT_RATIOS.includes(options.aspectRatio as AspectRatio)
    ? options.aspectRatio
    : "1:1"

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: { aspectRatio: aspectRatio as AspectRatio },
    },
  })

  const candidates = response.candidates
  if (!candidates?.[0]?.content?.parts) return null

  for (const part of candidates[0].content.parts) {
    if (part.inlineData?.data) {
      return {
        imageBuffer: Buffer.from(part.inlineData.data, "base64"),
        mimeType: part.inlineData.mimeType ?? "image/png",
      }
    }
  }
  return null
}

export async function editLogoImage(
  prompt: string,
  sourceImageBuffer: Buffer,
  sourceMimeType = "image/png"
): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  const ai = getClient()
  const base64 = sourceImageBuffer.toString("base64")

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      { inlineData: { mimeType: sourceMimeType, data: base64 } },
      prompt,
    ],
    config: {
      responseModalities: ["IMAGE", "TEXT"],
    },
  })

  const candidates = response.candidates
  if (!candidates?.[0]?.content?.parts) return null

  for (const part of candidates[0].content.parts) {
    if (part.inlineData?.data) {
      return {
        imageBuffer: Buffer.from(part.inlineData.data, "base64"),
        mimeType: part.inlineData.mimeType ?? "image/png",
      }
    }
  }
  return null
}

export async function batchGenerateLogos(
  prompt: string,
  count: number,
  options: { aspectRatio?: string; delayMs?: number } = {}
): Promise<Array<{ index: number; imageBuffer: Buffer; mimeType: string } | { index: number; error: string }>> {
  const delay = options.delayMs ?? 3000
  const results: Array<{ index: number; imageBuffer: Buffer; mimeType: string } | { index: number; error: string }> = []

  for (let i = 0; i < count; i++) {
    try {
      const result = await generateLogoImage(prompt, { aspectRatio: options.aspectRatio })
      if (result) {
        results.push({ index: i, ...result })
      } else {
        results.push({ index: i, error: "No image generated" })
      }
    } catch (e) {
      results.push({ index: i, error: e instanceof Error ? e.message : "Unknown error" })
    }

    // Delay between requests (except last)
    if (i < count - 1 && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return results
}
