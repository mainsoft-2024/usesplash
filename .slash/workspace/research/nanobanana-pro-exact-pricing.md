# Research: Google Gemini Image Generation Exact Pricing (2025-2026)

**Date**: April 17, 2026  
**Topic**: Nano Banana Pro / Nano Banana image generation token costs and per-image pricing

---

## Summary

Google Gemini offers two distinct image generation models with different pricing tiers: **Nano Banana Pro** (Gemini 3 Pro Image Preview, model ID `gemini-3-pro-image-preview`) for premium quality, and **Nano Banana** (Gemini 2.5 Flash Image, model ID `gemini-2.5-flash-image`) for budget-friendly generation. Both use token-based pricing with separate rates for text input, image input, and image output tokens.

---

## Model Pricing Overview

### Nano Banana Pro (Gemini 3 Pro Image Preview)

| Model ID | Status | Context Window | Max Output |
|----------|--------|-------------|-----------|
| `gemini-3-pro-image-preview` | Premium Preview | 65,536 tokens | 32,768 tokens |

**Token Pricing** (as of March 2026, verified from ai.google.dev):

| Token Type | Price per 1M Tokens |
|-----------|-------------------|
| Text/Image Input | $2.00 |
| Text/Thinking Output | $12.00 |
| **Image Output** | **$120.00** |

### Nano Banana (Gemini 2.5 Flash Image)

| Model ID | Status | Context Window | Max Output |
|----------|--------|-------------|-----------|
| `gemini-2.5-flash-image` | GA (as of Oct 2025) | 32,768 tokens | 32,768 tokens |

**Token Pricing**:

| Token Type | Price per 1M Tokens |
|-----------|-------------------|
| Text/Image Input | $0.30 |
| Text Output | $2.50 |
| **Image Output** | **$30.00** |

---

## Token Consumption Breakdown

### Input Image Token Count

When you send an image **for editing, upscaling, or as a reference**, Google charges a fixed token count:

| Model | Input Image Tokens |
|-------|------------------|
| **Nano Banana Pro** (gemini-3-pro-image-preview) | **560 tokens** |
| **Nano Banana** (gemini-2.5-flash-image) | **258 tokens** (for small images ≤384px); larger images are tiled |

**Cost per input image**:
- Nano Banana Pro: 560 tokens × $2.00/1M = **$0.0011** per input image
- Nano Banana: 258 tokens × $0.30/1M = **$0.0000774** per small input image

### Output Image Token Count (Generation)

The output token count depends on the **resolution** of the generated image:

| Model | Resolution | Output Tokens | Cost per Image |
|-------|------------|--------------|-------------|
| **Nano Banana Pro** | 1K (1024×1024) | 1,120 | $0.134 |
| **Nano Banana Pro** | 2K (2048×2048) | 1,120 | $0.134 |
| **Nano Banana Pro** | 4K (4096×4096) | 2,000 | $0.24 |
| **Nano Banana** | 1K (1024×1024) | 1,290 | $0.039 |
| **Nano Banana** | 2K (2048×2048) | ? | ~$0.05-0.07 |
| **Nano Banana** | 4K (4096×4096) | ? | ~$0.10 |

**Calculation**: Output tokens × $output_rate / 1,000,000

---

## Resolution Tiers

Google Gemini image generation supports these resolution tiers:

| Tier | Resolution | MegaPixels | Notes |
|------|-----------|-----------|-------|
| **0.5K** | ~512×512 | 0.25MP | Available on Gemini 3.1 Flash Image only |
| **1K** | 1024×1024 | 1MP | Standard preview generation |
| **2K** | 2048×2048 | 4MP | Available on Pro and Flash |
| **4K** | 4096×4096 | 16MP | Premium tier, highest cost |
| **21:9 ultrawide** | 4096×1728 | ~7MP | Cinematic aspect ratio |

Supported aspect ratios: 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9

---

## Scenario Cost Calculations

### Scenario A: Text-to-Image Generation (1 Logo at ~1024×1024)

**Input**: Text prompt only (~200 input text tokens)  
**Output**: 1 image at 1024×1024 (1K resolution)

#### Nano Banana Pro (`gemini-3-pro-image-preview`)

| Component | Token Count | Rate | Cost |
|-----------|-----------|------|------|
| Text Input | 200 | $2.00/1M | $0.0004 |
| Image Output | 1,120 | $120.00/1M | $0.1344 |
| **TOTAL** | | | | **$0.1348** (~$0.135) |

#### Nano Banana (`gemini-2.5-flash-image`)

| Component | Token Count | Rate | Cost |
|-----------|-----------|------|------|
| Text Input | 200 | $0.30/1M | $0.00006 |
| Image Output | 1,290 | $30.00/1M | $0.0387 |
| **TOTAL** | | | | **$0.0388** (~$0.039) |

---

### Scenario B: Image-to-Image Upscale (Input 1024×1024 → Output 4K)

**Input**: Text prompt (~200 tokens) + 1 input image (for upscaling/reference)  
**Output**: 1 image at 4096×4096 (4K resolution)

#### Nano Banana Pro (`gemini-3-pro-image-preview`)

| Component | Token Count | Rate | Cost |
|-----------|-----------|------|------|
| Text Input | 200 | $2.00/1M | $0.0004 |
| Input Image | 560* | $2.00/1M | $0.0011 |
| Image Output | 2,000 | $120.00/1M | $0.24 |
| **TOTAL** | | | **$0.2415** (~$0.242) |

*Input image token count for Nano Banana Pro

#### Nano Banana (`gemini-2.5-flash-image`)

| Component | Token Count | Rate | Cost |
|-----------|-----------|------|------|
| Text Input | 200 | $0.30/1M | $0.00006 |
| Input Image | 258 | $0.30/1M | $0.000077 |
| Image Output | ~2,000* | $30.00/1M | ~$0.06 |
| **TOTAL** | | | **~$0.06** |

*Exact 4K token count varies; estimate based on Pro scaling

---

## Cost Comparison Summary

| Scenario | Model | Input Cost | Output Cost | Total per Image |
|----------|-------|-----------|------------|----------------|
| **A: Text→1K** | Nano Banana Pro | $0.0004 | $0.134 | **$0.135** |
| **A: Text→1K** | Nano Banana | $0.00006 | $0.039 | **$0.039** |
| **B: Image→4K** | Nano Banana Pro | $0.0015 | $0.24 | **$0.242** |
| **B: Image→4K** | Nano Banana | $0.00014 | $0.06 | **$0.06** |

---

## Key Insights

### Does Gemini charge differently for image-to-image vs text-to-image?

**Yes**. The key difference is the **input image token charge**:

- **Text-to-image** (generation): Only text input tokens + image output tokens
- **Image-to-image** (editing/upscaling): Adds **input image tokens** to the bill

For Nano Banana Pro, input images cost **$0.0011** each (560 tokens at $2.00/1M). This is a small add-on (~1% of total cost) but still significant at scale.

### Input image token calculation

According to Google's token documentation ([ai.google.dev/gemini-api/docs/tokens](https://ai.google.dev/gemini-api/docs/tokens)):

- Images ≤384px in both dimensions: **258 tokens**
- Images larger: Cropped/scaled into 768×768 tiles, each tile = **258 tokens**
- Gemini 3 Pro: Uses `media_resolution` parameter for granular control

For a 1024×1024 input image being used as reference/editing input:
- Nano Banana Pro: 560 tokens (documented)
- Nano Banana: ~258 tokens (base) to ~560 tokens (tiled)

---

## Batch API Discount

Google offers a **Batch API** that provides **50% discount** on image output:

| Model | Standard | Batch (50% off) |
|-------|----------|-----------------|
| Nano Banana Pro 1K-2K | $0.134/image | $0.067/image |
| Nano Banana Pro 4K | $0.24/image | $0.12/image |
| Nano Banana 1K | $0.039/image | $0.0195/image |

Batch is suitable for non-interactive workloads (e.g., background generations).

---

## Rate Limits (2025-2026)

### Images Per Minute (IPM)

| Model | Standard Tier | Priority Tier |
|-------|-------------|-------------|
| Gemini 3 Pro Image | ~10-15 IPM | ~50 IPM |
| Gemini 2.5 Flash Image | ~50 IPM | Up to 200 IPM |

Tier 1 rate limit (Google AI Studio): **10 IPM** for image generation.

### Free Tier

- **Gemini 2.0 Flash**: Up to 1,500 free images/day (experimental)
- **Nano Banana Pro**: No free tier (paid only as of March 2026)
- **Nano Banana**: No free tier

---

## References

- Official pricing: [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Token counting: [ai.google.dev/gemini-api/docs/tokens](https://ai.google.dev/gemini-api/docs/tokens)
- Vertex AI pricing: [cloud.google.com/vertex-ai/generative-ai/pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- Gemini 3 Pro Image docs: [docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image)
- Gemini 2.5 Flash Image docs: [docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-image](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-image)

---

## Recommendations for Logo Generation

For a logo design SaaS like Splash:

1. **For initial preview generation**: Use Nano Banana at $0.039/image (Scenario A) — 72% cheaper than Pro
2. **For high-quality 4K export**: Use Nano Banana Pro at $0.24/image (Scenario B) — premium quality
3. **Input image cost is negligible**: At ~$0.001/image, input reference images add <1% to total
4. **Budget option**: Use Batch API for non-interactive generations — 50% off

For 10,000 monthly logo generations:
- All Nano Banana: ~$390/month
- All Nano Banana Pro: ~$1,340/month (1K-2K)
- Mixed (80% Nano Banana, 20% Pro): ~$558/month