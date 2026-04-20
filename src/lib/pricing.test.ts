import { describe, expect, it } from "vitest"
import {
  BLOB_PRICE_PER_GB_MONTH,
  GEMINI_IMAGE_PRICE_USD,
  PLAN_PRICE_USD,
  blobCost,
  imageCost,
  llmCost,
} from "./pricing"

describe("imageCost", () => {
  it("returns 0 for zero images", () => {
    expect(imageCost(0)).toBe(0)
  })

  it("calculates image cost by count", () => {
    expect(imageCost(3)).toBeCloseTo(3 * GEMINI_IMAGE_PRICE_USD)
  })
})

describe("llmCost", () => {
  it("returns 0 for zero tokens", () => {
    expect(llmCost(0, 0)).toBe(0)
  })

  it("calculates input and output token costs", () => {
    expect(llmCost(1_000_000, 1_000_000)).toBeCloseTo(3.5)
  })
})

describe("blobCost", () => {
  it("returns 0 for zero bytes", () => {
    expect(blobCost(0)).toBe(0)
  })

  it("handles very large byte counts", () => {
    expect(blobCost(1_000_000_000_000)).toBeCloseTo(1_000 * BLOB_PRICE_PER_GB_MONTH)
  })
})

describe("PLAN_PRICE_USD", () => {
  it("returns undefined for unknown tier", () => {
    const price = PLAN_PRICE_USD["team" as keyof typeof PLAN_PRICE_USD]
    expect(price).toBeUndefined()
  })
})
