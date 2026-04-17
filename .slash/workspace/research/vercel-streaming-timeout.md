# Research: Vercel Serverless Function Timeouts for Streaming AI Responses

**Date:** 2026-04-13

## Summary

Vercel's serverless functions support streaming AI responses with configurable timeouts up to 800 seconds (13 minutes) on Pro/Enterprise plans. The `maxDuration` config applies to the entire function execution, including streaming waits. For long-running AI operations (60+ seconds), the HTTP stream remains alive as long as tokens are being streamed. Vercel recommends using `waitUntil` for post-response background work, while long-running AI should be split into workflows using tools like Inngest or Upstash Workflow.

---

## Findings

### 1. Max Duration for Vercel Serverless Functions (Different Plans)

With **Fluid Compute** enabled (default since 2025):

| Plan | Default | Maximum |
|------|---------|---------|
| Hobby | 300s (5 min) | 300s (5 min) |
| Pro | 300s (5 min) | 800s (13 min) |
| Enterprise | 300s (5 min) | 800s (13 min) |

Without Fluid Compute (legacy limits):

| Plan | Default | Maximum |
|------|---------|---------|
| Hobby | 10s | 60s |
| Pro | 15s | 300s |

**Source:** [Vercel Function Duration Limits](https://vercel.com/docs/functions/configuring-functions/duration)

**Configuration options:**
```typescript
// In route file (Next.js App Router)
export const maxDuration = 60; // seconds

// Or in vercel.json
{
  "functions": {
    "app/api/chat/route.ts": { "maxDuration": 60 }
  }
}
```

---

### 2. Does `maxDuration` Affect Streaming Responses?

**Yes.** Duration includes all time the function runs, including time spent waiting for streamed responses.

> "This refers to the actual time elapsed during the entire invocation, regardless of whether that time was actively used for processing or spent waiting for a streamed response."

**Source:** [Vercel Configuring Maximum Duration](https://vercel.com/docs/functions/configuring-functions/duration)

This means if your AI model takes 60 seconds to generate a response, that 60 seconds counts against your `maxDuration`. For Edge Functions, the limit is 300 seconds max with a 25-second requirement to send the first response chunk.

---

### 3. When Using `streamText` with Tools Taking 60+ Seconds, Does HTTP Stream Stay Alive?

**Yes, the stream stays alive as long as tokens are being sent.** Vercel counts duration toward the max even while waiting for AI responses, but streaming keeps the connection active.

**Key points:**
- Streaming does NOT make you immune to timeouts
- If the handler stalls mid-stream or stops sending chunks, Vercel can cut it off
- Optimize for "time to first token" — do auth, user state fetch, and retrieval fast before streaming begins

**Source:** [HeyDev: Vercel Function Timeouts for AI 2026](https://heydev.us/blog/vercel-function-timeouts-ai-nextjs-2026)

---

### 4. Vercel Recommended Pattern for Long-Running AI Operations

Vercel recommends **splitting work into workflows** rather than long-running single requests:

1. **Use `waitUntil` (or `after` in Next.js)** for post-response tasks like logging, analytics, cache updates
2. **Use workflow tools** for multi-step AI operations:
   - **Inngest** (durable functions)
   - **Upstash Workflow / QStash**
   - **Custom queue with worker**

> "If you are building an AI feature that must run for minutes, stop pretending it is a request-response pattern."

**Source:** [HeyDev: Vercel Function Timeouts for AI 2026](https://heydev.us/blog/vercel-function-timeouts-ai-nextjs-2026)

**Example using `after` (Next.js):**
```typescript
import { after } from 'next/server';
import { streamText } from 'ai';

export async function POST(request: Request) {
  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    tools: myTools,
  });

  // Return streaming response immediately
  return result.toDataStreamResponse({
    onFinish: () => {
      // Continue processing after response sent
      after(async () => {
        await logAnalytics();
        await updateCache();
      });
    },
  });
}
```

---

### 5. Does OpenRouter Have Its Own Timeout for Tool Call Responses?

**OpenRouter does not enforce a strict timeout on tool calls**, but:

1. **Upstream provider timeouts** apply — each underlying provider (Anthropic, OpenAI, etc.) may have its own limits
2. **Rate limits** apply: free models have ~10 req/min, paid tiers vary by model
3. **Best practice:** Set your own `request_timeout` — one project added a 180-second (3 min) timeout to prevent indefinite hangs

**Source:** [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview), [GPT Researcher PR #1565](https://github.com/assafelovic/gpt-researcher/pull/1565)

**In Vercel AI SDK with OpenRouter:**
```typescript
const result = streamText({
  model: openai('anthropic/claude-3.5-sonnet'),
  // No built-in timeout at OpenRouter level
  // Set abort signal for client-side timeout
});
```

---

### 6. Can We Use Vercel's `waitUntil` to Continue Processing After Response Sent?

**Yes.** `waitUntil` (or `after` in Next.js) allows background processing after the HTTP response is sent.

```typescript
import { waitUntil } from '@vercel/functions';

export async function GET(request: Request) {
  // Background task runs after response
  waitUntil(
    fetch('https://analytics.example.com/track', {
      method: 'POST',
      body: JSON.stringify({ event: 'page_view' })
    })
  );

  // Response returns immediately
  return new Response('OK');
}
```

**In Next.js:**
```typescript
import { after } from 'next/server';

// After response is sent, continue processing
after(async () => {
  await longRunningTask(); // runs after client receives response
});
```

**Important notes:**
- `waitUntil` continues until the configured maxDuration (up to 800s), not indefinitely
- Errors in background tasks don't affect the client response
- Use for: logging, analytics, cache updates, notification sending
- Don't use for: critical operations that must complete — use a proper job queue

**Source:** [Vercel waitUntil Documentation](https://vercel.com/changelog/waituntil-is-now-available-for-vercel-functions)

---

## Recommendations for AI Operations with 60+ Second Tool Calls

1. **Increase `maxDuration`** for routes that need it (e.g., `export const maxDuration = 300;`)
2. **Stream responses** to keep the connection alive and improve perceived latency
3. **Use `after`/`waitUntil`** for non-critical post-processing (logging, cache updates)
4. **For critical multi-step AI work**, use a workflow system (Inngest, Upstash Workflow)
5. **Set client-side abort signals** as a safety net:
   ```typescript
   const result = streamText({
     model: openai('gpt-4o'),
     messages,
     abortSignal: AbortSignal.timeout(120000), // 2 min timeout
   });
   ```
6. **Configure provider timeouts** in Vercel AI Gateway for fast failover:
   ```typescript
   providerOptions: {
     gateway: {
       providerTimeouts: { byok: { openai: 30000 } }
     }
   }
   ```

---

## Image Generation: One-by-One vs All at Once

### The Key Question: Is a Human Waiting?

**When a human is waiting (interactive)** → Generate one-by-one with streaming

**Evidence:** [Google Gemini - Batch vs Realtime Workflow](https://www.aifreeapi.com/en/posts/gemini-image-generation-workflow-batch-vs-realtime)

> "If a person is waiting on the image or edit result, stay on synchronous generateContent. If the work is non-urgent and high volume, move it to Batch API."

This is the fundamental split:
- **Interactive/user-facing**: Synchronous one-by-one with streaming
- **Background/batch**: Batch API or concurrent requests

### Recommendation for AI Chat with Images

For streaming AI responses that include images:

1. **Generate images in parallel** using `Promise.all()` (faster than sequential)
2. **Stream each image as it completes** - don't wait for all to finish
3. **Progressive feedback**: Show "Generating image X..." before completion

```typescript
// Example: Stream AI text + generate images in parallel
export async function POST(req: Request) {
  const { prompt, imageCount = 3 } = await req.json();
  
  // Start streaming text response immediately
  const textStream = streamText({
    model: openai('gpt-4o'),
    messages: [{ role: 'user', content: prompt }],
  });
  
  // Generate images in parallel (don't block the text stream)
  const imagePromises = Array.from({ length: imageCount }, (_, i) => 
    generateImage(prompt, i).catch(err => ({ error: err.message }))
  );
  
  // Resolve images in background, stream URLs as they complete
  imagePromises.forEach(async (promise) => {
    const image = await promise;
    // Stream image URL to client via separate mechanism or append to response
  });
  
  return textStream.toDataStreamResponse();
}
```

### Speed Comparison: One-by-One vs Batch

| Approach | 10 Images | Notes |
|----------|-----------|-------|
| Sequential | ~40s | One at a time |
| Concurrent (Promise.all) | ~8s | Parallel generation |
| Provider Batch API | ~10s | Often 10% cheaper |

**Source:** [ZSky Batch Image API](https://zsky.ai/blog/ai-batch-image-generation-api)

### Best Practice Summary

| Scenario | Approach |
|----------|----------|
| User waiting for result | One-by-one, stream progress |
| Background job | Batch API or concurrent |
| Multiple images in chat | Promise.all() + stream each result |
| Iterative refinement | Single image, refine with follow-up |