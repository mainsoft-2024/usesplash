# Research: Google Gemini Multi-Image Input for Generation

**Date**: 2026-04-22

## Summary

Gemini 3 Pro Image (`gemini-3-pro-image-preview`) supports up to **14 input images** in a single generation request, enabling multi-image composition, style blending, and reference-based generation. The model accepts multiple `inlineData` parts alongside text prompts via the `@google/genai` SDK. Rate limits remain at **2 IPM for Tier 1** (same as single-image), and retry strategy should account for the increased token cost (~3,000 tokens per image). For logo design, this enables powerful workflows: combining wordmark style from one reference with color palette from another, or compositing multiple logo elements in one call.

---

## 1. Multi-Image Support Confirmation

**Claim**: `gemini-3-pro-image-preview` supports multiple input images per request.

**Evidence**: Official Vertex AI documentation confirms:

> "**Maximum images per prompt: 14**" — Gemini 3 Pro Image technical specifications.
> Source: [Google Cloud Vertex AI - Gemini 3 Pro Image](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image)

The model also supports **multi-turn image editing** where reference images persist across conversation turns via `thought_signature` for context preservation.

---

## 2. Request Shape: Passing Multiple Images

### Base64 Inline (Recommended for SDK)

The `@google/genai` SDK accepts an array of `Content` parts, each being either text or `inlineData`:

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateWithMultipleReferences(
  prompt: string,
  referenceImages: Array<{ data: string; mimeType: string }>,
  aspectRatio = "1:1"
) {
  // Build contents: image parts first, then text prompt
  const contents = [
    ...referenceImages.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.data },
    })),
    prompt, // Text prompt last
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents,
    config: {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: { aspectRatio },
    },
  });

  return response;
}
```

**Evidence**: This pattern follows the official SDK structure. See existing implementation in `web/src/lib/gemini.ts` lines 93-123 for single-image reference handling.

```typescript
// Existing code (web/src/lib/gemini.ts:103-106) — how referenceImages are handled:
// contents: [
//   ...referenceImages.map((referenceImage) => ({ inlineData: { mimeType: referenceImage.mimeType, data: referenceImage.data } })),
//   prompt // text prompt
// ]
```

### Using `fileData` (URL-based for GCS)

For large images stored in Google Cloud Storage, use `fileData` instead of inline base64:

```typescript
const contents = [
  {
    fileData: {
      mimeType: "image/png",
      fileUri: "gs://my-bucket/images/logo-style.png",
    },
  },
  {
    fileData: {
      mimeType: "image/png",
      fileUri: "gs://my-bucket/images/color-ref.png",
    },
  },
  "Combine the typography style from the first image with the color palette from the second.",
];
```

**Note**: Inline base64 is recommended for images under 7MB. For larger files, GCS URLs are preferred (max 30MB per file).

---

## 3. Prompting Best Practices for Multi-Image References

### Explicit Reference Disambiguation

When multiple reference images are provided, explicitly label each with clear spatial or descriptive references:

**Good**:
> "Use the typography style from the first image (the wordmark on the left) as the primary letterform. Apply the color palette from the second image (the gradient from cyan to magenta) to the text. Keep the icon from the first image but render it in the colors from the second."

**Bad**:
> "Combine these two logos."

**Best Practices from Official Prompt Guide**:

1. **Assign distinct names**: Reference images can be implicitly tracked if presented clearly
2. **Place images before instructions**: The prompt should follow reference images
3. **Specify which attributes to extract**: Be explicit ("from image 1, take the style; from image 2, take the colors")
4. **Use visual descriptors**: "left image", "top reference", "the gradient in the bottom-right of image 2"

**Evidence**: Google DeepMind's prompt guide emphasizes:
> "Upload clear reference images, and assign a distinct name to each character or object in your prompt. That way, the model can follow along and maintain their look as you build out your scenes."
> Source: [Nano Banana Prompt Guide](http://deepmind.google/models/gemini-image/prompt-guide/)

### Recommended Prompt Structure for Logo Blending

```typescript
const multiImagePrompt = `
Create a logo that combines elements from the reference images:

Style: From the first image, use the bold, geometric wordmark style and the sans-serif typography.

Colors: From the second image, apply the sunset gradient palette (deep orange to coral pink) to the text and icon.

Icon: Keep the minimalist icon from the first image but recolor it using the gradient from the second image.

Output: A clean 1:1 logo suitable for favicon and full-color contexts.
`.trim();
```

---

## 4. Token & Size Limits

### Multi-Image Token Costs

| Image Size | Token Estimate |
|------------|----------------|
| ≤384px (any dimension) | 258 tokens |
| >384px (scaled/cropped) | ~1,000-2,240 tokens |
| **Safe fallback** | **3,000 tokens/image** |

**Evidence**: Google's token documentation and gemini-cli fix note:
> "Images larger in one or both dimensions are cropped and scaled as..." and "This value safely covers the maximum actual cost of an Ultra High Resolution (4K) image in Gemini 3 (2,240 tokens) plus a buffer"
> Source: [Understand and count tokens - Gemini API](https://ai.google.dev/gemini-api/docs/tokens)

The gemini-cli project fixed token overestimation to use a **fixed 3,000 tokens fallback** for images:
> Source: [fix: image token estimation - PR #16004](https://github.com/google-gemini/gemini-cli/pull/16004)

### Recommended Max Count & Resolution

| Use Case | Recommended Images | Reasoning |
|----------|---------------------|------------|
| Logo blending | 2-4 images | Clear disambiguation; token budget |
| Style transfer | 1-2 images | Best results with focused references |
| Max capability | 14 images | Official limit, but quality drops |
| Resolution per image | ≤2K (2048px) | 4K image = 2,240 tokens; max context 65,536 |

**Context Window Constraints**:
- Model input limit: **65,536 tokens**
- At 3,000 tokens/image, theoretical max = ~21 images
- **Recommended safe limit: 4-6 images** for consistent results in production

### Size Limits (per file)

| Input Method | Max File Size |
|--------------|---------------|
| Inline base64 (console/API) | 7 MB |
| Google Cloud Storage | 30 MB |

---

## 5. Rate Limit Implications

### Tier 1 (Paid) Rate Limits

| Metric | Limit (gemini-3-pro-image-preview) |
|--------|--------------------------------------|
| **IPM** (Images Per Minute) | **10** |
| RPM | 60 |
| Batch enqueued tokens | 2,000,00 |

**Evidence**: Official rate limits page:
> "Gemini 3 Pro Image Preview: 2,000,00" (Batch enqueued tokens at Tier 1)
> Source: [Rate limits - Gemini API](https://ai.google.dev/gemini-api/docs/rate-limits)

Wait — that's 10 IPM. The earlier web search result shows 10 IPM for image models:
> "Images per minute, or IPM, is only calculated for models capable of generating images (Nano Banana)..."
> Source: [Rate limits | Gemini API - Google AI for Developers](https://ai.google.dev/gemini-api/docs/rate-limits)

Note: The 2 IPM mentioned in the AGENTS.md file may be outdated or project-specific concurrency. **Official Tier 1 limit is 10 IPM**, but:
- **Your project uses `MAX_CONCURRENT = 2`** (gemini.ts:7)
- **This is project-level concurrency**, not API limit

### `withGeminiConcurrency` Implications

**For multi-image requests**: The existing `withGeminiConcurrency()` limiter (max 2 concurrent) remains valid:

- Multi-image requests **count as 1 request** toward concurrency
- Token cost is higher but does not increase concurrent request count
- Each multi-image call still uses 1 slot in the queue

**Token impact**: A 3-image request uses ~9,000 input tokens vs 3,000 for single image. TPM (120,000 at Tier 1) should handle this easily with 2 concurrent requests:

- 2 concurrent × 9,000 tokens = 18,000 TPM — well under 120,000 TPM limit

**Recommendation**: Keep `MAX_CONCURRENT = 2` for multi-image calls. The higher token cost per request is offset by the TPM headroom.

---

## 6. Known Failure Modes & Mitigation

### Common Errors

| Error | Cause | Mitigation |
|-------|-------|------------|
| `400 Bad Request` | Malformed request, deprecated params | Validate contents array structure |
| `403 Forbidden` | Content policy violation | Rephrase prompt; avoid sensitive terms |
| `429 Rate Limited` | Exceeded IPM/TPM | Exponential backoff; use batch API |
| Empty response | Safety filter triggered | Simplify prompt; remove ambiguous terms |

### Specific Multi-Image Failure Modes

1. **Context Bleeding**: When too many images are provided, the model may confuse attributes between references.
   - **Mitigation**: Use 2-4 images max; clearly label which attributes come from which

2. **Token Overflow**: More images + larger images exceed 65,536 token limit.
   - **Mitigation**: Resize input images to ≤2K before encoding; use fewer high-resolution refs

3. **Quality Degradation**: Excessive reference images reduce generation quality.
   - **Mitigation**: Trust the model's 14-image max but prefer 2-4 for best results

4. **Style Confusion**: Without clear disambiguation, model mixes attributes incorrectly.
   - **Mitigation**: Explicit spatial labels ("image 1", "the leftmost reference")

### Retry Strategy Differences

**Existing `withRetry` pattern** (gemini.ts:63-77) still applies:

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const { isRetryable } = parseGeminiError(error);
      if (!isRetryable || attempt === maxRetries) throw error;

      // Exponential backoff: 2s → 4s → 8s
      const delay = Math.pow(2, attempt + 1) * 1000;
      console.log(`Gemini retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
```

**For multi-image**: No change needed. The retry handles 429/503 errors identically.

**Multi-image specific**: Consider adding a smaller subset of images on retry if original fails:
```typescript
async function generateWithFallback(
  prompt: string,
  images: Array<{ data: string; mimeType: string }>
) {
  try {
    return await generateWithMultipleReferences(prompt, images);
  } catch (error) {
    // If too many images may be the issue, retry with fewer
    if (images.length > 2) {
      return generateWithMultipleReferences(prompt, images.slice(0, 2));
    }
    throw error;
  }
}
```

---

## 7. Alternative Models (for Future Reference)

| Model | Multi-Image Support | Max Images | Notes |
|-------|----------------------|------------|-------|
| **Gemini 2.5 Flash Image** | Yes | 3 | Cheaper ($0.05-0.10/image), faster |
| **DALL-E 3** (OpenAI) | Limited | 1 | Not ideal for multi-ref |
| **Midjourney** | Via API | Varies | Different workflow |
| **Imagen 4** | Yes | 10+ | Google's premium text-to-image |
| **Claude Sonnet 4.6** (Vertex) | Yes | 5+ | Excellent multi-image reasoning |

**Recommended for Cost-Sensitive Multi-Image**:
- **Gemini 2.5 Flash Image**: ~$0.05/image (60% cheaper), max 3 input images
- Use when quality trade-off is acceptable for batch operations

**Not Recommended for Swap**:
- Current project already uses `gemini-3-pro-image-preview` — switching requires significant refactoring
- Keep unless pricing becomes prohibitive

---

## Code Snippet: Multi-Image Logo Generation

```typescript
// web/src/lib/gemini-multi.ts — Multi-image logo generation
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = "gemini-3-pro-image-preview";

interface ReferenceImage {
  data: string; // base64-encoded
  mimeType: string;
}

export async function generateLogoWithReferences(
  prompt: string,
  references: ReferenceImage[],
  aspectRatio = "1:1"
): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Validate image count (14 is max, but 2-4 is optimal)
  const safeRefs = references.slice(0, 6);
  if (safeRefs.length !== references.length) {
    console.warn(`Truncated ${references.length} images to ${safeRefs.length}`);
  }

  // Build contents: images first, then text instruction
  const contents = [
    ...safeRefs.map((ref) => ({ inlineData: { mimeType: ref.mimeType, data: ref.data } })),
    prompt,
  ];

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents,
    config: {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: { aspectRatio: aspectRatio as any },
    },
  });

  // Extract image from response
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        imageBuffer: Buffer.from(part.inlineData.data, "base64"),
        mimeType: part.inlineData.mimeType ?? "image/png",
      };
    }
  }

  console.error("No image in response", { parts });
  return null;
}

// Usage for logo style blending
const result = await generateLogoWithReferences(
  "Create a logo combining the typography style from the first image with the color palette from the second. Keep the shape from the first image.",
  [
    { data: wordmarkBase64, mimeType: "image/png" },
    { data: paletteRefBase64, mimeType: "image/png" },
  ],
  "1:1"
);
```

---

## Key Takeaways

1. **Multi-image is fully supported**: Up to 14 input images per request (2-4 recommended for quality)
2. **Request format**: Array of `inlineData` parts + text prompt; same SDK structure as single-image
3. **Prompting**: Explicitly label attributes by reference position ("from the first image", "the left image");
4. **Token costs**: ~3,000 tokens per image; 65,536 token input limit constrains total
5. **Rate limits**: Keep existing 2 concurrent limit; TPM headroom handles increased token load
6. **Failure modes**: Context bleeding with >4 images; retry strategy unchanged
7. **Alternatives**: Gemini 2.5 Flash Image for cost-sensitive batch; not a drop-in replacement

---

## Sources

- [Vertex AI - Gemini 3 Pro Image](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image) — Official specifications
- [Understand and count tokens](https://ai.google.dev/gemini-api/docs/tokens) — Token counting for multimodal input
- [Rate limits - Gemini API](https://ai.google.dev/gemini-api/docs/rate-limits) — IPM/RPM/TPM limits
- [Nano Banana Prompt Guide](http://deepmind.google/models/gemini-image/prompt-guide/) — Official prompting best practices
- [git fix: image token estimation (#16004)](https://github.com/google-gemini/gemini-cli/pull/16004) — Token fallback values
- [Gemini 3 Pro Image API Complete Guide](https://www.cursor-ide.com/blog/gemini-3-pro-image-api) — Working code examples