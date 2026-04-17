# Research: @google/genai SDK Image Generation
Date: 2026-04-13

## Summary
The `@google/genai` SDK (v1.49.0) provides comprehensive image generation capabilities via Gemini's "Nano Banana" models. For `gemini-2.0-flash-preview-image-generation`, the API uses `response_modalities: ["IMAGE"]` or `["TEXT", "IMAGE"]` in the config. Images are returned via `part.inlineData` containing base64-encoded data with `mimeType: "image/png"`. Image editing is best handled through chat mode with the source image passed as inlineData. Rate limiting is strict on the Free tier (0 IPM as of Dec 2025), requiring at minimum Tier 1 billing.

---

## 1. How to Call Image Generation with `gemini-2.0-flash-preview-image-generation`

### Installation
```bash
npm install @google/genai
```

### Basic Generation
```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateImage() {
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-preview-image-generation',
    contents: 'Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme',
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  // Extract image from response
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const base64ImageBytes = part.inlineData.data;
      const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
    }
  }
}
```

**Evidence** ([Google Developers Blog](https://developers.googleblog.com/en/generate-images-gemini-2-0-flash-preview/)):
> Image Generation capabilities are now available in preview with Gemini 2.0 Flash... using the model name "gemini-2.0-flash-preview-image-generation".

---

## 2. Exact API for Generating Images - Parameters and Response Format

### Parameters
| Field | Type | Description |
|-------|------|-------------|
| `model` | string | Model ID (e.g., `gemini-2.0-flash-preview-image-generation`) |
| `contents` | string \| Part[] | Prompt text or multimodal content array |
| `config` | GenerateContentConfig | Optional configuration |

### GenerateContentConfig Options
| Field | Type | Description |
|-------|------|-------------|
| `responseModalities` | `["TEXT"]` \| `["IMAGE"]` \| `["TEXT", "IMAGE"]` | Output format (required for images) |
| `temperature` | number (0.0-1.0) | Sampling temperature |
| `maxOutputTokens` | number | Max tokens in response |
| `imageConfig` | ImageConfig | Image-specific settings |

### ImageConfig Options
| Field | Type | Description |
|-------|------|-------------|
| `resolution` | `"1K"` \| `"2K"` \| `"4K"` | Output resolution |
| `aspectRatio` | string (e.g., `"1:1"`, `"16:9"`) | Aspect ratio |

### Response Format
The response object contains `candidates[0].content.parts[]`:

```typescript
interface Part {
  text?: string;           // Text response
  inlineData?: {
    mimeType: string;   // e.g., "image/png"
    data: string;    // Base64-encoded image
  };
}
```

**Evidence** ([DeepWiki - js-genai](https://deepwiki.com/googleapis/js-genai/5.2-image-generation-and-editing)):
> Content Generation — The `Models` class exposes three image-specific methods... `generateImages`, `editImage`, and `upscaleImage`... All image methods use `types.Image` to represent image data. An `Image` can carry image content either as inline bytes.

---

## 3. Image Editing (Source Image + Edit Prompt)

### Method 1: Chat Mode (Recommended)
```typescript
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';

const ai = new GoogleGenAI({});

async function editImage() {
  const imageBuffer = fs.readFileSync('path/to/image.png');
  const imageBase64 = imageBuffer.toString('base64');

  // Create chat session
  const chat = ai.chats.create({ model: 'gemini-2.5-flash-image' });

  // Send image with edit instruction
  const response = await chat.sendMessage({
    content: [
      { inlineData: { mimeType: 'image/png', data: imageBase64 } },
      'Make it a bananas foster.'
    ]
  });

  // Get edited image(s)
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const base64ImageBytes = part.inlineData.data;
      const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
    }
  }
}
```

**Evidence** ([Google IO Codegen Instructions](https://github.com/googleapis/js-genai/blob/89400098/codegen_instructions.md)):
> Editing images is better done using the Gemini native image generation model, and it is recommended to use chat mode. Configs are not supported in this model (except modality).

### Method 2: Direct generateContent with Multimodal Input
```typescript
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';

async function editImageDirect() {
  const imageData = fs.readFileSync('input.png');
  const base64Image = imageData.toString('base64');

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-preview-image-generation',
    contents: [
      { text: 'Make the colors more vibrant and add a subtle gradient' },
      { inlineData: { mimeType: 'image/png', data: base64Image } },
    ],
    config: {
      responseModalities: ['IMAGE'],
    },
  });
}
```

---

## 4. Common Error Patterns and Handling

### Error Codes
| HTTP Code | Status | Description | Solution |
|----------|-------|-------------|-----------|
| 400 | INVALID_ARGUMENT | Malformed request | Check API reference format |
| 400 | FAILED_PRECONDITION | Free tier not available in region | Enable billing in AI Studio |
| 403 | PERMISSION_DENIED | Wrong API key | Verify API key permissions |
| 404 | NOT_FOUND | File not found | Check file references |
| 429 | RESOURCE_EXHAUSTED | Rate limit exceeded | Implement retry logic |
| 500 | INTERNAL | Google backend error | Reduce context or retry |
| 503 | UNAVAILABLE | Service overloaded | Retry with backoff |
| 504 | DEADLINE_EXCEEDED | Processing timeout | Simplify prompt |

**Evidence** ([Google Troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting)):
> 429 RESOURCE_EXHAUSTED — You've exceeded the rate limit. You are sending too many requests per minute with the free tier Gemini API. Verify that you're within the model's rate limit. Request a quota increase if needed.

### Error Handling Implementation
```typescript
async function generateImageWithRetry(prompt: string, maxRetries = 3): Promise<string | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-preview-image-generation',
        contents: prompt,
        config: { responseModalities: ['IMAGE'] },
      });
      
      return response.candidates[0].content.parts[0].inlineData?.data ?? null;
    } catch (error: any) {
      if (error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
        const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  return null;
}
```

---

## 5. Response Format - inlineData with Base64

### Yes, Response Contains inlineData with Base64
The image is returned in `part.inlineData` as base64-encoded string:

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.0-flash-preview-image-generation',
  contents: prompt,
  config: { responseModalities: ['IMAGE'] },
});

// Iterate through parts
for (const part of response.candidates[0].content.parts) {
  if (part.inlineData) {
    console.log(`Mime type: ${part.inlineData.mimeType}`); // "image/png"
    console.log(`Base64 length: ${part.inlineData.data.length}`);
    
    // Create data URL for display
    const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    
    // Or save to file
    fs.writeFileSync('output.png', Buffer.from(part.inlineData.data, 'base64'));
  }
}
```

**Evidence** ([Context7 Docs](https://context7.com/googleapis/js-genai/llms.txt)):
> The response contains image data in the `inlineData` field with base64-encoded data.

### Alternative: Using Interactions API
```typescript
const interaction = await ai.interactions.create({
  model: 'gemini-3-pro-image-preview',
  input: 'Generate an image of a futuristic city.',
  response_modalities: ['image'],
});

for (const output of interaction.outputs!) {
  if (output.type === 'image') {
    console.log(`Generated image with mime_type: ${output.mime_type}`);
    fs.writeFileSync('generated_city.png', Buffer.from(output.data!, 'base64'));
  }
}
```

---

## 6. Rate Limiting / Quota Issues

### Current State (April 2026)
As of December 2025, Google significantly changed image generation rate limits:

| Tier | IPM (Images Per Minute) | Requirement |
|------|-------------------|-------------|
| Free | N/A (effectively 0) | Not available |
| Tier 1 | 10 IPM | Billing enabled |
| Tier 2 | 30 IPM | $250+ spend, 30 days |
| Tier 3 | 60+ IPM | $1,000+ spend, 30 days |

**Evidence** ([AI Free API](https://aifreeapi.com/en/posts/gemini-image-rate-limit-solution)):
> Image 429 errors usually come from one of two root causes: the project does not yet have billable image access, or the project has exhausted a quota window that Google enforces at the project level.

### Key Points
1. **Free tier has NO image generation** - Requires at minimum Tier 1 (billing enabled)
2. **Quotas are per PROJECT, not per API key**
3. **RPD resets at midnight Pacific Time**
4. **Batch API has separate quota** with 50% discount

**Evidence** ([Google Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)):
> Images per minute, or IPM, is only calculated for models capable of generating images (Nano Banana)... Rate limits are applied per project, not per API key. Requests per day (RPD) quotas reset at midnight Pacific time.

### Handling Rate Limits
```typescript
// Pattern: Track requests and implement client-side throttling
class RateLimiter {
  private Requests: number[] = [];
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    
    if (this.requests.length >= this.limit) {
      const waitTime = this.windowMs - (now - this.requests[0]);
      await new Promise(r => setTimeout(r, waitTime));
    }
    this.requests.push(now);
  }
}

// Usage: 10 IPM = max 1 request per 6 seconds
const limiter = new RateLimiter(10, 60000);

async function limitedGenerate(prompt: string) {
  await limiter.acquire();
  return ai.models.generateContent({ /* ... */ });
}
```

---

## Model Alternatives Reference

For better availability and features, consider these newer models:

| Model | Name | Best For |
|-------|------|---------|
| `gemini-2.5-flash-image` | Nano Banana | Fast image generation, high volume |
| `gemini-3-pro-image-preview` | Nano Banana Pro | High-quality, 4K output |
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | Balanced speed/quality |
| `gemini-2.0-flash-preview-image-generation` | Gemini 2.0 Preview | Original preview |

**Evidence** ([Codegen Instructions](https://github.com/googleapis/js-genai/blob/89400098/codegen_instructions.md)):
> Models — Fast Image Generation and Editing: `gemini-2.5-flash-image` (aka Nano Banana)... High-Quality Image Generation and Editing: `gemini-3-pro-image-preview` (aka Nano Banana Pro)

---

## Summary Checklist

- [x] Use `gemini-2.0-flash-preview-image-generation` model
- [x] Set `responseModalities: ["TEXT", "IMAGE"]` or `["IMAGE"]` in config
- [x] Extract image from `part.inlineData.data` (base64)
- [x] For editing: use chat mode with source image as inlineData
- [x] Handle 429 errors with exponential backoff
- [x] Enable billing for any image generation (Free tier doesn't support it)
- [x] Monitor project-level quotas in Google Cloud Console