# Research: Google Gemini Image Generation API Pricing

**Date:** 2026-04-15

## Summary

Google's Gemini image generation (including `gemini-3-pro-image-preview`, also known as Gemini 2.0 Flash image generation or "Nano Banana") uses **token-based pricing** — not flat per-image pricing. The cost varies significantly by model tier, resolution, and whether you're generating new images or editing existing ones. There is **no free tier** for image generation models on the API.

---

## 1. Cost Per Image Generation (gemini-3-pro-image-preview)

### Token-Based Pricing Structure

| Token Type | Price (per 1M tokens) |
|------------|----------------------|
| Input (text/image) | $2.00 |
| Output (text/thinking) | $12.00 |
| Output (image) | $120.00 |

### Per-Image Cost Breakdown

| Resolution | Output Tokens | Cost Per Image | Batch Cost (50% off) |
|------------|---------------|----------------|---------------------|
| 1K (1024×1024) | 1,120 | $0.134 | $0.067 |
| 2K (2048×2048) | 1,120 | $0.134 | $0.067 |
| 4K (4096×4096) | 2,000 | $0.24 | $0.12 |

**Formula:** `Cost = (Output Tokens × $120) / 1,000,000`

For a standard 1K-2K image: `(1,120 tokens × $120) / 1,000,000 = $0.134`

### Model Comparison

| Model | Status | 1K Cost | 4K Cost | Best For |
|-------|--------|---------|---------|----------|
| `gemini-2.5-flash-image` | Legacy (shuts down Oct 2, 2026) | $0.039 | N/A | Cheapest while available |
| `gemini-3.1-flash-image-preview` | Current default | $0.067 | $0.151 | Most new builds |
| `gemini-3-pro-image-preview` | Premium | $0.134 | $0.24 | High-quality assets |

---

## 2. Rate Limits

Rate limits depend on your **usage tier**:

### Usage Tiers

| Tier | Qualification | Billing Cap |
|------|--------------|-------------|
| Free | Active project | N/A |
| Tier 1 | Set up billing | $250 |
| Tier 2 | Paid $100 + 3 days | $2,000 |
| Tier 3 | Paid $1,000 + 30 days | $20,000 - $100,000+ |

### Rate Limit Dimensions

- **RPM** (Requests Per Minute)
- **TPM** (Tokens Per Minute)
- **RPD** (Requests Per Day)
- **IPM** (Images Per Minute) — specifically for image generation models

### Free Tier Limits (AI Studio)

| Access Method | Daily Limit | Rate Limit |
|---------------|-------------|------------|
| AI Studio Web | 500-1,000 | 15 RPM |
| Gemini API Free | 100-500 | 2-15 RPM |

### Batch API Limits (Tier 1)

| Model | Batch Enqueued Tokens |
|-------|----------------------|
| Gemini 3.1 Flash Image Preview | 750,000,000 |
| Gemini 2.5 Flash Image Preview | 3,000,000 |

**Batch Processing:** 50% discount but 2-24 hour processing time. Max 100 concurrent batch requests.

---

## 3. Free Tier vs Paid Tier

### Free Tier

- **Available for:** Text models only (Gemini 2.5 Flash, 2.5 Pro, etc.)
- **NOT available for:** Image generation models (`gemini-2.5-flash-image`, `gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview`)
- AI Studio web: 500-1,000 images/day (free, but limited)
- Gemini app: 2-4 images/day (free)

### Paid Tier

- **Required for:** All Gemini image generation API models
- Higher rate limits
- Access to Batch API (50% discount)
- Context caching (up to 90% savings on repeated prompts)

---

## 4. Per-Image vs Per-Pixel Pricing

**Pricing is token-based, NOT per-pixel or flat per-image.** However, token count correlates directly with resolution:

| Resolution | Dimensions | Tokens/Image | Practical Cost |
|------------|------------|--------------|----------------|
| 512px | 512×512 | 747 | $0.045 |
| 1K | 1024×1024 | 1,120 | $0.067 |
| 2K | 2048×2048 | 1,680 | $0.101 |
| 4K | 4096×4096 | 2,520 | $0.151 |

**Note:** 1K and 2K cost the same on `gemini-3-pro-image-preview` because they consume the same token count (1,120).

---

## 5. How Pricing Works

### Token-Based Billing

1. **Input tokens:** Your text prompt + any reference images
2. **Output tokens:** Generated text + generated image(s)
3. **Each modality has different rates:**
   - Text input: ~$2.00/M tokens
   - Image input: ~560 tokens per image (~$0.0011)
   - Text output: ~$12.00/M tokens
   - Image output: ~$120.00/M tokens

### Cost Formula for a Single Image

```
Total Cost = (Input Text Tokens × $2.00/M) + 
             (Input Image Tokens × $2.00/M) + 
             (Output Text Tokens × $12.00/M) + 
             (Output Image Tokens × $120.00/M)
```

For a typical 100-token prompt generating a 1K image:
- Input text: negligible (~$0.0002)
- Image output: $0.134
- **Total: ~$0.134**

---

## 6. Generating vs Editing (Image-to-Image)

### Text-to-Image (New Image Generation)

- Only image output tokens are charged
- Cost: $0.134 per 1K image (gemini-3-pro-image-preview)

### Image-to-Image (Editing Existing Images)

When you edit/generate from a reference image:

| Operation | Input Cost | Output Cost |
|-----------|------------|-------------|
| Image input | 560 tokens (~$0.0011 per image) | — |
| Text input | $2.00/M tokens | — |
| Image output | — | $120.00/M tokens |

**Example: Editing 1 reference image → 1 output image**
- Input: 560 tokens × $2.00/M = $0.0011
- Output: 1,120 tokens × $120.00/M = $0.134
- **Total: ~$0.135** (slightly higher than text-to-image)

### Key Differences

| Workflow | Input Tokens | Output Tokens | Typical Cost |
|----------|--------------|---------------|--------------|
| Text → Image | ~100 (text) | 1,120 (image) | $0.134 |
| Image → Image | ~560 (image) + ~100 (text) | 1,120 (image) | $0.135 |
| Multi-image editing (14 refs) | ~560 × 14 + text | 1,120 + text | ~$0.15+ |

Google's image models support up to **14 reference images** per request, which increases input token costs proportionally.

---

## 7. Practical Examples

### Example 1: Logo Generation SaaS (1,000 images/day)

- Model: `gemini-3.1-flash-image-preview` (1K)
- Cost: $0.067 × 1,000 = **$67/day** ($2,010/month)

### Example 2: Batch Processing (10,000 images)

- Model: `gemini-3-pro-image-preview` (2K)
- Batch pricing: $0.067 × 10,000 = **$670** (vs $1,340 standard)

### Example 3: Image Editing with 5 Reference Images

- 5 reference images: 560 × 5 = 2,800 tokens
- Input cost: 2,800 × $2.00/M = $0.0056
- Output (2K): $0.134
- **Total: ~$0.14 per edited image**

---

## 8. Key Takeaways

1. **No free tier** for image generation API — always paid
2. **Token-based pricing** — image output tokens are expensive ($120/M)
3. **Resolution matters** — 4K costs ~80% more than 1K/2K
4. **Image input adds cost** — ~$0.0011 per reference image
5. **Batch API** offers 50% discount for non-real-time workloads
6. **gemini-3-pro-image-preview** is the premium option (~$0.134/image)
7. **gemini-3.1-flash-image-preview** is the current default (~$0.067/image)
8. **gemini-2.5-flash-image** is cheapest but deprecated (~$0.039/image, shuts down Oct 2026)

---

## Sources

- [Google AI Developer - Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Google AI Developer - Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Google AI Developer - Billing](https://ai.google.dev/gemini-api/docs/billing)
- [AI Free API - Gemini Image Generation Cost Calculator](https://aifreeapi.com/en/posts/gemini-image-generation-api-pricing)
- [AI Free API - Gemini 3 Pro Image Preview Pricing](https://aifreeapi.com/en/posts/gemini-3-pro-image-preview-pricing)
- [Google Developers Blog - Gemini 2.5 Flash Image](https://developers.googleblog.com/en/introducing-gemini-25-flash-image/)
