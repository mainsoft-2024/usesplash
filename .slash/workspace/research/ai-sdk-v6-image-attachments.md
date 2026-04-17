# Research: AI SDK v6 Image Attachments in Chat Messages

**Date**: 2026-04-14

## Summary

AI SDK v6 (released December 2025) uses a **parts-based message architecture** that differs significantly from v3/v4. Image attachments are sent via the `parts` array in `sendMessage()`, not via `experimental_attachments`. The server uses `convertToModelMessages()` to transform UI parts into model-compatible content. OpenRouter passes through image URLs/base64 directly to the underlying provider (Google Gemini, OpenAI, etc.).

---

## 1. How `useChat` / `sendMessage` Support Image Attachments in AI SDK v6

### Client-Side API

In AI SDK v6, you use `sendMessage()` with a `parts` array:

```tsx
import { useChat } from '@ai-sdk/react';

const { messages, sendMessage } = useChat();

// Send message with image
sendMessage({
  role: 'user',
  parts: [
    { type: 'text', text: 'Describe this image' },
    { type: 'file', mediaType: 'image/png', url: 'https://example.com/image.png' },
  ],
});
```

### Alternative: `files` property

You can also use the `files` property (simpler for pre-defined files):

```tsx
sendMessage({
  text: 'Look at these images',
  files: [
    { type: 'file', filename: 'photo.jpg', mediaType: 'image/jpeg', url: '...' },
    // or base64: { type: 'file', filename: 'x.png', mediaType: 'image/png', data: '...' }
  ],
});
```

### File Part Type Definition

```typescript
interface FileUIPart {
  type: 'file';
  filename?: string;
  mediaType: string;  // 'image/png', 'image/jpeg', 'application/pdf'
  url?: string;       // Public URL
  data?: string;     // Base64 encoded
}
```

### Deprecated: `experimental_attachments`

In AI SDK v5, `experimental_attachments` was used. This **has been replaced** by the `parts` array in v6. See migration guide: the `experimental_attachments` property has been replaced with the `parts` array, and file attachments are now represented as file parts with type `'file'` and include a `mediaType` property.

---

## 2. Correct API for Image Parts in v6

### Sending Images

Two approaches:

**A. Using `parts` array (recommended for dynamic content):**

```tsx
sendMessage({
  role: 'user',
  parts: [
    { type: 'file', mediaType: 'image/png', url: imageUrl },
    { type: 'text', text: prompt },
  ],
});
```

**B. Using `files` property (simpler):**

```tsx
sendMessage({
  text: prompt,
  files: [
    { type: 'file', mediaType: 'image/png', url: 'https://...' },
  ],
});
```

### Supported File Types

- Images: `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- Documents: `application/pdf`

### Base64 Images

For local/base64 images:

```tsx
const fileParts = await convertFilesToDataURLs(files);

sendMessage({
  role: 'user',
  parts: [
    { type: 'text', text: input },
    ...fileParts,  // { type: 'file', mediaType: 'image/png', data: 'base64...' }
  ],
});
```

---

## 3. Server-Side `convertToModelMessages()` Handling

The server receives UIMessage objects from the client and converts them to model-compatible messages:

### Basic Conversion

```typescript
// app/api/chat/route.ts
import { convertToModelMessages, streamText } from 'ai';
import { openrouter } from '@openrouter/ai'; // or your provider

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = streamText({
    model: openrouter('google/gemini-2.5-flash'),
    messages: convertToModelMessages(messages),
  });
  
  return result.toUIMessageStreamResponse();
}
```

### How It Transforms File Parts

`convertToModelMessages()` automatically converts UI `file` parts to model-specific content:

- For OpenAI: `{ type: 'image', image: url | buffer }`
- For Gemini (via OpenRouter): `{ type: 'image_url', image_url: { url } }`

### With Tools

```typescript
const result = streamText({
  model: openrouter('google/gemini-2.5-flash'),
  messages: convertToModelMessages(messages, {
    tools: {
      screenshotTool,  // Can return multi-modal output
    },
  }),
});
```

### Multi-Modal Tool Responses

Tools can return images via `toModelOutput`:

```typescript
const screenshotTool = tool({
  inputSchema: z.object({}),
  execute: async () => 'imgbase64',
  toModelOutput: ({ output }) => [{ type: 'image', data: output }],
});
```

---

## 4. OpenRouter + Gemini Vision Handling

### OpenRouter Image Input Format

OpenRouter passes images to Gemini using the OpenAI-compatible format:

```typescript
// OpenRouter accepts:
{
  role: 'user',
  content: [
    { type: 'text', text: 'Describe this image' },
    { type: 'image_url', image_url: { url: 'https://...' } },
    // or base64:
    { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } },
  ],
}
```

### How AI SDK Converts

1. Client sends: `{ type: 'file', url: 'https://...' }`
2. `convertToModelMessages()` transforms to provider format
3. For OpenRouter/Gemini → becomes `{ type: 'image_url', image_url: { url } }`

### Gemini Vision Models on OpenRouter

| Model | Context | Input Price |
|-------|---------|-------------|
| `google/gemini-2.5-flash` | 1M | $0.30/M tokens |
| `google/gemini-3.1-pro-preview` | 1M | $2/M tokens |
| `google/gemini-3-flash-preview` | 32K | (varies) |

All support image input via URL or base64.

### Supported Image Types

- `image/png`
- `image/jpeg`
- `image/gif`
- `image/webp`

---

## 5. Code Examples

### Complete Example: File Upload + Chat

```tsx
// app/page.tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRef, useState } from 'react';

export default function Chat() {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  // Helper: Convert FileList to data URLs
  async function convertFilesToDataURLs(fileList: FileList) {
    const promises = Array.from(fileList).map(file => {
      return new Promise<FileUIPart>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            type: 'file',
            filename: file.name,
            mediaType: file.type,
            url: reader.result as string,  // data:URL
          });
        };
        reader.readAsDataURL(file);
      });
    });
    return Promise.all(promises);
  }

  return (
    <div>
      {/* Render messages */}
      {messages.map(m => (
        <div key={m.id}>
          <span>{m.role === 'user' ? 'User: ' : 'AI: '}</span>
          {m.parts.map((part, i) => {
            if (part.type === 'text') return <span key={i}>{part.text}</span>;
            if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
              return <img key={i} src={part.url} alt={part.filename || 'image'} />;
            }
            return null;
          })}
        </div>
      ))}

      {/* Upload form */}
      <form
        onSubmit={async event => {
          event.preventDefault();
          const fileParts = files ? await convertFilesToDataURLs(files) : [];
          sendMessage({
            role: 'user',
            parts: [{ type: 'text', text: input }, ...fileParts],
          });
          setInput('');
          setFiles(undefined);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      >
        <input
          type="file"
          accept="image/*,application/pdf"
          ref={fileInputRef}
          onChange={e => setFiles(e.target.files || undefined)}
        />
        <input value={input} onChange={e => setInput(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### Server-Side (API Route)

```typescript
// app/api/chat/route.ts
import { convertToModelMessages, streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openrouter('google/gemini-2.5-flash'),
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

### Simple Image URL Example

```tsx
const [imageUrl, setImageUrl] = useState('https://example.com/image.png');

sendMessage({
  role: 'user',
  parts: [
    ...(imageUrl ? [{ type: 'file' as const, mediaType: 'image/png', url: imageUrl }] : []),
    { type: 'text' as const, text: 'What do you see?' },
  ],
});
```

---

## Key References

- **AI SDK Docs - useChat**: https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat
- **AI SDK Docs - convertToModelMessages**: https://sdk.vercel.ai/docs/reference/ai-sdk-ui/convert-to-model-messages
- **AI SDK v6 Blog**: https://vercel.com/blog/ai-sdk-6
- **Stream Text with Image Prompt (Official Example)**: https://sdk.vercel.ai/examples/next-pages/chat/use-chat-image-input
- **OpenRouter Image Inputs**: https://openrouter.ai/docs/guides/overview/multimodal/images
- **Migration Guide (v4→v5)**: https://github.com/vercel/ai/blob/main/content/docs/08-migration-guides/26-migration-guide-5-0.mdx