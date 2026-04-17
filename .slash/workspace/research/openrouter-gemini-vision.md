# Research: OpenRouter Gemini Vision Support

**Date**: 2026-04-17

## Summary

OpenRouter **does support vision/image input** for Gemini models including `google/gemini-3-flash-preview`. The API uses the standard OpenAI-compatible format with a content array containing `type: "image_url"` objects. The Vercel AI SDK (`@openrouter/ai-sdk-provider`) supports this natively through its chat API.

---

## Findings

### 1. OpenRouter Image Input Support

**Claim**: OpenRouter passes image content (base64 or URL) to Gemini models

**Evidence** (https://openrouter.ai/docs/guides/overview/multimodal/images):

> Requests with images, to multimodal models, are available via the `/api/v1/chat/completions` API with a multi-part `messages` parameter. The `image_url` can either be a URL or a base64-encoded image.

The model `google/gemini-3-flash-preview` explicitly supports **multimodal inputs including text, images, audio, video, and PDFs** (https://openrouter.ai/google/gemini-3-flash-preview).

---

### 2. Correct Message Format

**Claim**: The correct message format uses `type: "image_url"` in the content array

**Evidence** (https://openrouter.ai/docs/guides/overview/multimodal/images):

```typescript
// With image URL
const messages = [
  {
    role: "user",
    content: [
      { type: "text", text: "What's in this image?" },
      { type: "image_url", image_url: { url: "https://example.com/image.jpg" } },
    ],
  },
];

// With base64-encoded image
const messages = [
  {
    role: "user",
    content: [
      { type: "text", text: "What's in this image?" },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } },
    ],
  },
];
```

**Key format notes**:
- Use `type: "image_url"` with object `image_url: { url: "..." }` (note the camelCase `image_url`)
- Base64 images must use data URL format: `data:image/jpeg;base64,{base64_data}`
- OpenRouter recommends sending text first, then images for optimal parsing

---

### 3. Vercel AI SDK Integration

**Claim**: The `@openrouter/ai-sdk-provider` handles image parts in messages correctly

**Evidence** (https://github.com/OpenRouterTeam/ai-sdk-provider/blob/7c043a08/src/schemas/image.ts):

```typescript
const ImageResponseSchema = z.object({
  type: z.literal('image_url'),
  image_url: z.object({ url: z.string() }).passthrough(),
}).passthrough();
```

The AI SDK provider supports vision through its standard chat interface. The chat completion messages support multipart content with image parts:

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const result = await generateText({
  model: openrouter.chatModel('google/gemini-3-flash-preview'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this image' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } },
      ],
    },
  ],
});
```

---

### 4. Vercel AI SDK v6 Compatibility

For Vercel AI SDK v6 with OpenRouter, use one of these approaches:

| Provider | Package | Usage |
|---------|---------|------|
| OpenRouter official | `@openrouter/ai-sdk-provider` | `createOpenRouter()` |
| OpenAI-compatible | `@ai-sdk/openai-compatible` | Custom base URL to OpenRouter |

The `@openrouter/ai-sdk-provider` is the recommended approach as it has native support for OpenRouter features like caching, provider options, etc.

---

### 5. Example: Splash Integration

Based on the Splash codebase in `/web/src/lib/gemini.ts`, here's how to integrate with OpenRouter for vision:

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function analyzeWithVision(imageBase64: string) {
  const result = await generateText({
    model: openrouter.chatModel('google/gemini-3-flash-preview'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this logo design' },
          { 
            type: 'image_url', 
            image_url: { url: `data:image/png;base64,${imageBase64}` } 
          },
        ],
      },
    ],
  });
  
  return result.text;
}
```

---

## Recommendations

1. **Use `@openrouter/ai-sdk-provider`** - It's the officially supported provider with proper vision support
2. **Use `type: "image_url"` format** - The OpenAI-compatible multipart content format
3. **Format base64 as data URL** - `data:image/png;base64,{base64_data}`
4. **Text first, then images** - OpenRouter recommends this ordering for optimal parsing
5. **Check model capabilities** - Not all Gemini models on OpenRouter support vision; verify via the model page

---

## References

- OpenRouter Image Inputs: https://openrouter.ai/docs/guides/overview/multimodal/images
- Gemini 3 Flash Preview: https://openrouter.ai/google/gemini-3-flash-preview
- OpenRouter AI SDK Provider: https://github.com/OpenRouterTeam/ai-sdk-provider
- AI SDK Image Generation: https://sdk.vercel.ai/docs/ai-sdk-core/image-generation