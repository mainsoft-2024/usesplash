export const GEMINI_IMAGE_PRICE_USD = 0.134
export const OPENROUTER_INPUT_PRICE_PER_M = 0.5
export const OPENROUTER_OUTPUT_PRICE_PER_M = 3
export const BLOB_PRICE_PER_GB_MONTH = 0.023
export const RECRAFT_VECTORIZE_USD = Number(process.env.RECRAFT_VECTORIZE_USD ?? 0.01)


export const PLAN_PRICE_USD = {
  free: 0,
  pro: 10,
  demo: 0,
  enterprise: 100,
} as const

export const LAST_VERIFIED = "2026-04-21"

const TOKENS_PER_MILLION = 1_000_000
const BYTES_PER_GB = 1_000_000_000

/** Returns Gemini image generation cost in USD for image count. */
export function imageCost(imageCount: number): number {
  return imageCount * GEMINI_IMAGE_PRICE_USD
}

export function recraftVectorizeCost(count: number): number {
  return count * RECRAFT_VECTORIZE_USD
}

/** Returns OpenRouter LLM cost in USD for input/output token counts. */
export function llmCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / TOKENS_PER_MILLION) * OPENROUTER_INPUT_PRICE_PER_M
  const outputCost = (outputTokens / TOKENS_PER_MILLION) * OPENROUTER_OUTPUT_PRICE_PER_M
  return inputCost + outputCost
}

/** Returns Vercel Blob monthly storage cost in USD for bytes. */
export function blobCost(bytes: number): number {
  return (bytes / BYTES_PER_GB) * BLOB_PRICE_PER_GB_MONTH
}
