# Research: API Cost Insights for Splash Logo SaaS

**Date:** 2026-04-21

**Purpose:** Build per-event cost tracking in `web/src/lib/pricing.ts` for the Splash AI logo generation platform.

---

## Summary

This document compiles current (2025-2026) pricing for all APIs used in the Splash platform, with sources and verification dates. It covers Google Gemini (image generation + LLM), OpenRouter, Vercel Blob, remove.bg, Recraft, Neon Postgres, and Vercel hosting. Each section includes pricing tiers, unit costs, and caveats where pricing is dynamic or unclear.

---

## Findings

### 1. Google Gemini — gemini-3-pro-image-preview (Nano Banana Pro)

| Resolution | Price per Image | Token Consumption | Notes |
|------------|---------------|-----------------|-------|
| 1K (1024×1024) | $0.134 | 1120 tokens | Standard output |
| 2K (2048×2048) | $0.134 | 1120 tokens | Same as 1K |
| 4K (4096×4096) | $0.240 | 2000 tokens | Premium tier |
| **Batch API** (1K/2K) | $0.067 | 1120 tokens | 50% discount |
| **Batch API** (4K) | $0.120 | 2000 tokens | 50% discount |
| Input image | $0.0011 | 560 tokens | Per input image |

**Unit:** Per generated image (output)

**Price in USD:** $0.134 (standard 1K/2K), $0.240 (4K)

**Notes / caveats:**
- Pricing is token-based: $120 per 1M image output tokens. A 1K/2K image outputs 1120 tokens → $0.134. A 4K image outputs 2000 tokens → $0.240.
- Batch API offers 50% discount but has longer turnaround (not suitable for real-time user flows).
- Input images are cheap: 560 tokens → $0.0011 per input image.
- Rate limit: 10 images per minute (Tier 1). Tier 2 allows higher throughput but pricing unchanged.

**Official source URL:** https://ai.google.dev/gemini-api/docs/pricing

**Last-verified date:** 2026-04-15

---

### 2. Google Gemini — gemini-3-flash-preview (LLM via OpenRouter)

| Token Type | Price per 1M Tokens |
|-----------|--------------------|
| Input | $0.50 |
| Output | $3.00 |
| Audio input | $1.00 |
| Cached input | $0.05 |

**Unit:** Per 1M tokens (input or output)

**Price in USD:** $0.50 input / $3.00 output per 1M tokens

**Notes / caveats:**
- Pricing is identical on Google AI Studio and Vertex AI.
- Context >200K tokens increases input price to $4.00/1M (unlikely for logo chat use cases).
- Thinking tokens are included in output price.
- This is the model used for LLM chat via OpenRouter.

**Official source URL:** https://ai.google.dev/gemini-api/docs/pricing

**Last-verified date:** 2026-04-15

---

### 3. OpenRouter — Markup Structure

| Model | Input $/1M | Output $/1M | Notes |
|-------|------------|------------|-------|
| google/gemini-3-flash-preview | $0.50 | $3.00 | Base passthrough |
| Weighted average (live) | ~$0.32–0.35 | $3.00 | Provider routing fee |

**Unit:** Per 1M tokens

**Price in USD:** $0.50/M input / $3.00/M output (direct passthrough)

**Notes / caveats:**
- OpenRouter passes through Google's base pricing with a small markup that varies by provider routing.
- The weighted average input price across providers is ~$0.32–0.35/M (vs $0.50 direct), likely due to Google Vertex routing credits.
- Output stays at exactly $3.00/M — no variance across providers.
- OpenRouter bills in your OpenRouter account; no separate line item for "Google" — it's aggregated.
- For Splash's use case (chat via OpenRouter → Google), assume $0.50/M input / $3.00/M output.

**Official source URL:** https://openrouter.ai/google/gemini-3-flash-preview

**Last-verified date:** 2026-04-18

---

### 4. Vercel Blob — Storage, Bandwidth & Operations

| Resource | Free (Hobby) | Pro Included | Overage Price |
|----------|--------------|-------------|----------------|
| Storage | 1 GB/month | 5 GB/month | $0.023/GB/month |
| Simple operations (reads) | 10K/month | 100K/month | $0.40/1M |
| Advanced operations (writes/uploads) | 2K/month | 10K/month | $5.00/1M |
| Data transfer (egress) | 10 GB/month | 100 GB/month | $0.05/GB |

**Unit:** Storage = $/GB/month. Operations = per million. Data transfer = $/GB.

**Price in USD:**
- Storage: $0.023/GB/month
- Simple operations: $0.40/1M
- Advanced operations: $5.00/1M
- Data transfer: $0.05/GB

**Notes / caveats:**
- Delete operations are free.
- Rate limits: Hobby 120/s (simple) / 15/s (advanced), Pro 120/s / 75/s.
- Pricing is regional — some regions may have slight variance. Default is ap-southeast-1.
- Data transfer charges apply to outbound (downloads), not uploads.
- Free tier should cover early product; main cost driver is storage if storing many generated logos.

**Official source URL:** https://vercel.com/docs/vercel-blob/usage-and-pricing

**Last-verified date:** 2026-04-04

---

### 5. remove.bg — Per-Image Pricing by Plan

| Plan | Price | Credits | $/image | Notes |
|------|-------|---------|--------|--------|
| Pay-as-you-go (3 credits) | $3 | 3 | $1.00 | Small top-up |
| Pay-as-you-go (75 credits) | $49 | 75 | $0.65 | Bulk discount |
| Pay-as-you-go (200 credits) | $99 | 200 | $0.50 | Mid-tier |
| Pay-as-you-go (500 credits) | $199 | 200 | $0.40 | Larger pack |
| Pay-as-you-go (4000 credits) | $999 | 4000 | $0.25 | Best rate |
| Lite (subscription) | $9/month | 40 | $0.225 | $9 ÷ 40 |
| Pro (subscription) | $39/month | 200 | $0.195 | $39 ÷ 200 |
| Volume Plus (subscription) | $89/month | 500 | $0.178 | $89 ÷ 500 |
| Free tier | $0 | 50/month | — | Preview only (0.25MP) |

**Unit:** Per image (full resolution)

**Price in USD:** ~$0.25–$1.00 per image depending on volume

**Notes / caveats:**
- Each full-resolution removal = 1 credit. Preview (up to 0.25MP) = free on web, ¼ credit via API/desktop apps.
- Free tier: 50 API calls/month, restricted to preview resolution.
- Subscription credits reset monthly; Pay-as-you-go credits never expire.
- Rate limit: 500 images/minute (decreases for high-MP images).
- For Splash: assuming export-on-demand (optional feature), use bulk Pay-as-you-go pricing at ~$0.30–0.40/image.

**Official source URL:** https://remove.bg/help/credits-plans, https://remove.bg/pricing

**Last-verified date:** 2026-04-21

---

### 6. Recraft — SVG Vectorization

| Operation | Cost (USD) | API Units | Notes |
|-----------|------------|----------|-------|
| Vectorization | $0.01 | 10 | Raster → SVG |
| Raster generation | $0.04 | 40 | V3 model |
| Vector generation | $0.08 | 80 | V3 model |
| Remove background | $0.01 | 10 | Via API |
| Replace background | $0.04 (raster) / $0.08 (vector) | 40 / 80 | — |
| Crisp upscale | $0.004 | 4 | — |

**Unit:** Per operation (per image)

**Price in USD:** $0.01 per vectorization

**Notes / caveats:**
- API pricing uses "API units" — 1000 units = $1.00.
- Vectorization = 10 units = $0.01 (cheapest operation on Recraft API).
- V3 model (current) is more expensive than V2 (deprecated).
- For Splash: SVG export = $0.01 per conversion.
- Recraft is optional — only used if user requests vector export.

**Official source URL:** https://www.recraft.ai/api, https://webflow.recraft.ai/docs

**Last-verified date:** 2026-04-21

---

### 7. Neon Postgres — Free Tier Limits + Paid Pricing

| Resource | Free | Launch | Scale |
|----------|------|--------|-------|
| Storage | 0.5 GB/project | $0.35/GB-month | $0.35/GB-month |
| Compute | 100 CU-hours/project | $0.106/CU-hour | $0.222/CU-hour |
| Egress (data transfer) | 5 GB/month | 100 GB/month, then $0.10/GB | 100 GB/month, then $0.10/GB |
| Projects | 20 (max) | 100 | 1000 |
| Branches | 10/project | 10/project | 25/project |
| Max compute size | 0.25 CU (1 GB RAM) | 2 CU (8 GB RAM) | 7 CU (32 GB RAM) |
| Neon Auth MAU | 60K | 1M | Unlimited |

**Unit:** Compute = $/CU-hour. Storage = $/GB-month. Egress = $/GB.

**Price in USD:**
- Free: $0 (storage: 0.5 GB, compute: 100 CU-hours/month, egress: 5 GB/month)
- Launch: $0.106/CU-hour + $0.35/GB-month storage
- Scale: $0.222/CU-hour + $0.35/GB-month storage

**Notes / caveats:**
- 1 CU (compute unit) ≈ 0.25 vCPU with 1 GB RAM.
- Free tier: 100 CU-hours/project/month = running 0.25 CU for 400 hours/month = enough for typical passive workload.
- Compute suspends when free hours exhausted (not charged — just pauses).
- Storage is persistent; compute scales to zero when idle (no cost when idle).
- Egress beyond free tier: $0.10/GB on paid plans.
- For Splash: Free tier sufficient until significant traffic. Launch plan at ~$19/month typical, Scale at ~$69/month.

**Official source URL:** https://neon.tech/docs/introduction/plans, https://neon.tech/docs/introduction/free-tier

**Last-verified date:** 2026-04-21

---

### 8. Vercel Hosting — Pro Plan

| Resource | Hobby (Free) | Pro Included | Overage |
|----------|--------------|-------------|----------|
| Platform fee | $0 | $20/month | — |
| Edge requests | 1M/month | 10M/month | $2/1M |
| Bandwidth | 100 GB/month | 1 TB/month | $0.10/GB |
| CPU (active) | 4 hours | 16 hours | $0.24/hour |
| Deploying seats | 1 | 1 included | $20/seat |
| Fast Data Transfer | — | 1 TB/month | Variable |

**Unit:** Platform fee = $/month. Seats = $/month. Usage = overage rates.

**Price in USD:** $20/month base (includes 1 seat + $20 credit)

**Notes / caveats:**
- Pro plan is $20/month per deploying team seat (not per user — includes self-serve Enterprise features).
- Monthly credit ($20) can be used flexibly across all Vercel products (Blob, Edge Functions, etc.).
- For Splash: using Pro for hosting. The $20 credit offsets ~40% of Blob storage at 5GB or ~400GB of data transfer.
- Additional seats: $20/month each (Owner/Member roles). Viewer seats are free.
- Overages apply if usage exceeds included amounts.
- For a small team (1–2 devs), Pro is $20–$40/month + overages.

**Official source URL:** https://vercel.com/docs/plans/pro-plan

**Last-verified date:** 2026-04-21

---

## Recommended pricing.ts Constants

```typescript
/**
 * API pricing constants for Splash AI Logo SaaS
 * Last verified: 2026-04-21
 * Source: Official pricing pages per provider
 */

// ============================================================================
// IMAGE GENERATION
// ============================================================================

export const GEMINI_3_PRO_IMAGE = {
  // gemini-3-pro-image-preview (Nano Banana Pro)
  // Pricing: token-based, $120/1M image output tokens
  standard: {
    // 1K (1024x1024) and 2K (2048x2048) — same token count
    perImage_1k2k: 0.134,
    perImage_4k: 0.24,
  },
  // Batch API — 50% discount
  batch: {
    perImage_1k2k: 0.067,
    perImage_4k: 0.12,
  },
  // Input images are cheap
  perInputImage: 0.0011,
  inputTokenCount: 560,
} as const;

// ============================================================================
// LLM (via OpenRouter)
// ============================================================================

export const GEMINI_3_FLASH = {
  // gemini-3-flash-preview — used via OpenRouter
  // OpenRouter passes through Google pricing with small routing fee
  modelId: 'google/gemini-3-flash-preview',
  inputPer1M: 0.50,
  outputPer1M: 3.00,
  // Weighted average (live) — slightly lower due to provider routing
  // Use this for cost estimation; actual varies by routing
  weightedAvgInputPer1M: 0.32,
} as const;

// ============================================================================
// STORAGE (Vercel Blob)
// ============================================================================

export const BLOB = {
  storagePerGB: 0.023,         // $/GB-month
  simpleOpsPer1M: 0.40,        // $0.40 per 1M read operations
  advancedOpsPer1M: 5.00,     // $5.00 per 1M write/upload operations
  dataTransferPerGB: 0.05,    // $/GB egress
  // Free tier limits (Hobby)
  free: {
    storageGB: 1,
    simpleOps: 10_000,
    advancedOps: 2_000,
    dataTransferGB: 10,
  },
  // Pro tier limits
  pro: {
    storageGB: 5,
    simpleOps: 100_000,
    advancedOps: 10_000,
    dataTransferGB: 100,
  },
} as const;

// ============================================================================
// BACKGROUND REMOVAL (remove.bg)
// ============================================================================

export const REMOVE_BG = {
  // Pay-as-you-go bulk pricing (best rate at scale)
  perImage_1credit: 0.25,      // At 4000 credits: $999 ÷ 4000
  perImage_500credits: 0.40,      // $199 ÷ 500
  perImage_200credits: 0.50,     // $99 ÷ 200
  perImage_75credits: 0.65,      // $49 ÷ 75
  // Subscription plans (monthly)
  liteMonthly: {
    price: 9,                 // $9/month
    credits: 40,
    perImage: 0.225,          // $9 ÷ 40
  },
  proMonthly: {
    price: 39,                // $39/month
    credits: 200,
    perImage: 0.195,           // $39 ÷ 200
  },
  // Free tier (preview only)
  freePreview: 0,             // 50 preview API calls/month
} as const;

// ============================================================================
// VECTOR EXPORT (Recraft)
// ============================================================================

export const RECRAFT = {
  vectorizationPerImage: 0.01,         // $0.01 per raster→SVG
  rasterGenerationPerImage: 0.04,   // $0.04 per raster (V3)
  vectorGenerationPerImage: 0.08,   // $0.08 per vector (V3)
} as const;

// ============================================================================
// DATABASE (Neon Postgres)
// ============================================================================

export const NEON = {
  // Free tier (sufficient for MVP)
  free: {
    storageGB: 0.5,                // Per project
    computeCUHours: 100,            // Per project/month
    egressGB: 5,                    // Per month
  },
  // Launch plan (pay-as-you-go)
  launch: {
    computePerCUHour: 0.106,
    storagePerGBMonth: 0.35,
    egressPerGB: 0.10,
  },
  // Scale plan
  scale: {
    computePerCUHour: 0.222,
    storagePerGBMonth: 0.35,
    egressPerGB: 0.10,
  },
} as const;

// ============================================================================
// HOSTING (Vercel Pro)
// ============================================================================

export const VERCEL = {
  pro: {
    platformFee: 20,                 // $/month per seat
    monthlyCredit: 20,             // Usage credit included
    edgeRequestsIncluded: 10_000_000,
    bandwidthIncluded: 1000,       // GB (1 TB)
    overage: {
      edgeRequestsPer1M: 2.00,
      bandwidthPerGB: 0.10,
    },
  },
  // Additional seats
  additionalSeat: 20,               // $/month per deploying seat
} as const;

// ============================================================================
// COST CALCULATION HELPERS
// ============================================================================

/**
 * Estimate cost per logo generation event
 * Input: resolution (1k, 2k, or 4k), isVectorExport (optional)
 */
export function estimateGenerationCost(
  resolution: '1k' | '2k' | '4k' = '1k',
  options?: { vectorExport?: boolean; inputImages?: number }
) {
  const imageCost = resolution === '4k' 
    ? GEMINI_3_PRO_IMAGE.standard.perImage_4k 
    : GEMINI_3_PRO_IMAGE.standard.perImage_1k2k;
  
  const inputImageCost = (options?.inputImages ?? 1) * GEMINI_3_PRO_IMAGE.perInputImage;
  const vectorCost = options?.vectorExport ? RECRAFT.vectorizationPerImage : 0;
  
  return imageCost + inputImageCost + vectorCost;
}

/**
 * Estimate LLM cost per chat message
 * Input: estimated input/output token counts
 */
export function estimateChatCost(inputTokens: number, outputTokens: number) {
  const inputCost = (inputTokens / 1_000_000) * GEMINI_3_FLASH.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * GEMINI_3_FLASH.outputPer1M;
  return inputCost + outputCost;
}
```

---

## Notes

- **Dynamic pricing:** OpenRouter's live weighted average input price (~$0.32/M) may vary hour-to-hour based on provider availability. The $0.50/M is Google's base — use for budgeting.
- **Batch vs real-time:** Gemini 3 Pro Image has a batch inference API at 50% discount but not suitable for user-facing requests (hours-long turnaround).
- **remove.bg optional:** Only used for optional export feature — not core to generation flow.
- **Recraft optional:** Only used for SVG vector export — keep behind feature flag.
- **Vercel Blob in budget:** At 5GB Pro tier, Blob costs ~$0.12/month. Main cost driver is storage (generated logos) — consider expiration/deletion policy.
- **Neon free is generous:** For a startup with low initial traffic, free tier should cover the first 6–12 months of database usage.
- **Vercel Pro credit:** The $20/month credit can offset Blob or other usage. Factor into cash flow planning.