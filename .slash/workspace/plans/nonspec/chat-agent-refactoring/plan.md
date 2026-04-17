---
created: 2026-04-13T23:59:00+09:00
last_updated: 2026-04-13T23:59:00+09:00
type: nonspec
change_id: chat-agent-refactoring
status: pending
trigger: "Agent stalls during image generation, tool results go missing, chat history lost on refresh — comprehensive refactoring of chat/agent system to use AI SDK v6 best practices with reliable Gemini image generation"
---

# Plan: Comprehensive Chat/Agent System Refactoring

## Background & Research

### Research Files
- `.slash/workspace/research/ai-sdk-v6-streaming-tools-best-practices.md`
- `.slash/workspace/research/gemini-image-gen-rate-limits.md`
- `.slash/workspace/research/nanobanana-vs-gemini-comparison.md`
- `.slash/workspace/research/ai-sdk-v6-tool-timeout-persistence.md`
- `.slash/workspace/research/vercel-streaming-timeout.md`
- `.slash/workspace/research/ai-sdk-v6-chat-persistence.md`
- `.slash/workspace/research/google-genai-image-generation.md`

### Root Causes of Agent Stalling

| # | Problem | Root Cause | Impact |
|---|---------|-----------|--------|
| 1 | Gemini returns null silently | `responseModalities: ["IMAGE"]` only — nanobanana uses `["IMAGE", "TEXT"]` which is more stable | Tool returns null, AI says "0/5 generated" |
| 2 | No retry on transient errors | No exponential backoff for 429/503 errors | Single failure = permanent failure |
| 3 | Rate limit collision | 5 parallel Gemini calls hit Tier 1 limit (10 IPM) | Multiple 429 errors |
| 4 | "Tool result is missing" error | `stopWhen: stepCountIs(5)` too high + tool execution timeout | Stream dies mid-conversation |
| 5 | Chat history lost on refresh | `useChat` `messages` prop is initial-only; `setMessages()` called but race condition with `initializedRef` | Messages disappear |
| 6 | `onFinish` parts reconstruction fragile | Manual reconstruction of parts from `response.messages` (ModelMessage) with `as any` casts | Saved parts don't match UIMessage format |

### Current Code: `web/src/lib/gemini.ts` (lines 1-134)

```typescript
import { GoogleGenAI } from "@google/genai"

const VALID_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const
type AspectRatio = (typeof VALID_ASPECT_RATIOS)[number]

const MODEL_NAME = "gemini-3-pro-image-preview"

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not set")
  return new GoogleGenAI({ apiKey })
}

export async function generateLogoImage(
  prompt: string,
  options: { aspectRatio?: string } = {}
): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  const ai = getClient()
  const aspectRatio = VALID_ASPECT_RATIOS.includes(options.aspectRatio as AspectRatio)
    ? options.aspectRatio
    : "1:1"

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseModalities: ["IMAGE"],  // BUG: should be ["IMAGE", "TEXT"]
        imageConfig: { aspectRatio: aspectRatio as AspectRatio },
      },
    })

    const candidates = response.candidates
    if (!candidates?.[0]?.content?.parts) {
      console.error("Gemini generateLogoImage missing candidates/content parts", {
        candidates: response.candidates,
      })
      return null  // BUG: silent null, no retry
    }

    for (const part of candidates[0].content.parts) {
      if (part.inlineData?.data) {
        return {
          imageBuffer: Buffer.from(part.inlineData.data, "base64"),
          mimeType: part.inlineData.mimeType ?? "image/png",
        }
      }
    }

    console.error("Gemini generateLogoImage missing inline image data", {
      parts: candidates[0]?.content?.parts,
    })
    return null
  } catch (error) {
    console.error("generateLogoImage failed:", error)
    return null  // BUG: no retry, swallows error
  }
}

export async function editLogoImage(
  prompt: string,
  sourceImageBuffer: Buffer,
  sourceMimeType = "image/png"
): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  const ai = getClient()
  const base64 = sourceImageBuffer.toString("base64")

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        { inlineData: { mimeType: sourceMimeType, data: base64 } },
        prompt,
      ],
      config: {
        responseModalities: ["IMAGE"],  // BUG: same as above
      },
    })
    // ... same null-return pattern
  } catch (error) {
    console.error("editLogoImage failed:", error)
    return null
  }
}

// DEAD CODE: batchGenerateLogos() is never called from anywhere
export async function batchGenerateLogos(...) { ... }
```

**Problems:**
- `responseModalities: ["IMAGE"]` only — Gemini is more stable with `["IMAGE", "TEXT"]`
- No retry logic for 429/503/transient errors
- Silent `null` returns — caller can't distinguish "API error" from "no image in response"
- `batchGenerateLogos()` is dead code (route.ts has its own inline batch logic)

### Current Code: `web/src/app/api/chat/route.ts` (lines 1-279)

```typescript
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildSystemPrompt } from "@/lib/chat/system-prompt"
import { generateLogoImage, editLogoImage } from "@/lib/gemini"
import { uploadImage, getStorageKey } from "@/lib/storage"

export const maxDuration = 120

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  compatibility: "compatible",
})

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4"

export async function POST(req: Request) {
  // ... auth, body parsing, project lookup ...

  const streamResult = streamText({
    model: openrouter(DEFAULT_MODEL),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      generate_batch: tool({
        description: "Generate a batch of logo variations...",
        inputSchema: z.object({
          prompt: z.string(),
          count: z.number().min(1).max(20).default(5),
          aspectRatio: z.string().default("1:1"),
        }),
        execute: async ({ prompt, count, aspectRatio }) => {
          // BUG: 5 parallel Gemini calls can hit 10 IPM rate limit
          const generatePromises = Array.from({ length: count }, (_, i) =>
            generateLogoImage(prompt, { aspectRatio })
              .then((result) => ({ index: i, result, error: null }))
              .catch((e) => ({ index: i, result: null, error: e.message })),
          )
          const results = await Promise.all(generatePromises)
          // ... save to DB ...
          return { generated: logos.length, total: count, logos }
        },
      }),
      edit_logo: tool({ ... }),
    },
    stopWhen: stepCountIs(5),  // BUG: too high, causes unnecessary LLM rounds
    onFinish: async ({ text, response }) => {
      // BUG: fragile parts reconstruction with `as any` casts
      const assistantMessages = response.messages.filter(m => m.role === "assistant")
      const parts: any[] = []
      for (const msg of assistantMessages) {
        if (typeof msg.content === "string") {
          if (msg.content) parts.push({ type: "text", text: msg.content })
          continue
        }
        for (const content of msg.content) {
          // ... manual type checking with as any ...
          if (content.type === "tool-call") {
            parts.push({
              type: `tool-${content.toolName}`,
              toolCallId: content.toolCallId,
              toolName: content.toolName,
              state: "output-available",
              input: (content as any).args ?? (content as any).input,
            })
          }
        }
      }
      // BUG: tool results merged with `find` by toolCallId — fragile
      const toolMessages = response.messages.filter(m => m.role === "tool")
      for (const msg of toolMessages) {
        // ... manual result matching ...
      }
      await prisma.chatMessage.create({
        data: { projectId, role: "assistant", content: text || "", parts: parts.length > 0 ? parts : undefined },
      })
    },
  })

  return streamResult.toUIMessageStreamResponse()
}
```

**Problems:**
- `Promise.all` with no concurrency limit — 5 simultaneous Gemini requests
- `stopWhen: stepCountIs(5)` — too high, model loops unnecessarily
- `onFinish` parts reconstruction is extremely fragile with `as any` casts
- No `consumeStream` — `onFinish` may not fire on abort
- `convertToModelMessages` called without `ignoreIncompleteToolCalls: true`
- Tool `execute` returns error as part of result object (good) but inconsistently

### Current Code: `web/src/lib/chat/hooks.ts` (lines 1-57)

```typescript
"use client"

import { useChat as useAIChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export function useProjectChat(projectId: string, initialMessages?: UIMessage[]) {
  const [input, setInput] = useState("")
  const initializedRef = useRef(false)

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { projectId } }),
    [projectId]
  )

  const chat = useAIChat({
    id: projectId,
    transport,
    // BUG: no `messages` prop passed — initial messages not set at init time
  })

  useEffect(() => {
    // BUG: race condition — initialMessages may change reference, causing re-trigger
    if (initialMessages && initialMessages.length > 0 && !initializedRef.current) {
      chat.setMessages(initialMessages)
      initializedRef.current = true
    }
  }, [initialMessages, chat.setMessages])

  // ...
}
```

**Problems:**
- `messages` prop not passed to `useChat()` — should be used for initial-only loading
- `setMessages()` in useEffect is a workaround with race conditions
- `initializedRef` prevents re-initialization but also blocks legitimate updates
- `chat.setMessages` in dependency array causes unnecessary re-runs

### Current Code: `web/src/app/projects/[id]/page.tsx` (lines 1-102)

```typescript
"use client"

// ... imports ...

export default function ProjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  // ...
  const chatMessages = trpc.chat.listByProject.useQuery({ projectId })

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!chatMessages.data) return []
    return chatMessages.data.map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      parts: (msg as any).parts 
        ? (msg as any).parts as UIMessage["parts"]  // BUG: stored parts format may not match UIMessage
        : [{ type: "text" as const, text: msg.content }],
      createdAt: new Date(msg.createdAt),
    }))
  }, [chatMessages.data])

  const chat = useProjectChat(projectId, initialMessages)
  // ...
  if (project.isLoading || chatMessages.isLoading) return <LoadingScreen />
  // ...
}
```

**Problems:**
- `(msg as any).parts` — stored parts may have wrong format (e.g., `type: "tool-generate_batch"` instead of `type: "tool-invocation"`)
- Loading guard `chatMessages.isLoading` returns before `useProjectChat` is called — but hook is already called above
- `useMemo` returns `[]` initially, then updates — but `useProjectChat` may already have initialized

### Current Code: `web/src/lib/chat/system-prompt.ts` (lines 1-56)

```typescript
export const LOGO_DESIGNER_SYSTEM_PROMPT = `You are an expert logo designer AI assistant...

## Interview Flow
1. Brand Name
2. Style
3. Colors
4. Aspect Ratio
5. Additional Details

## After Interview
Call generate_batch tool. Default to 5 variations.

## Modification Requests
- "3번 로고에서 색상을 빨간색으로 바꿔줘" → edit logo #3

## Language
Respond in the same language the user uses. Default to Korean.
`
```

**Problems:**
- No prompt engineering guidance for the `generate_batch` tool — the LLM passes the raw user description as the Gemini prompt
- Should include nanobanana's structured prompt format: Subject + Style + Details + Quality modifiers
- Should instruct the LLM to construct high-quality Gemini prompts with quality keywords

### Current Code: `web/src/components/chat-panel.tsx` (lines 1-185)

```typescript
// Tool rendering for generate_batch:
if (part.type === "tool-generate_batch") {
  const count = (part as any).input?.count ?? 5
  if (part.state === "input-available" || part.state === "input-streaming") {
    return (/* generating spinner */)
  }
  if (part.state === "output-available") {
    const output = (part as any).output as Record<string, unknown> | undefined
    const generated = Number(output?.generated ?? 0)
    // ... display result
  }
  // BUG: no output-error handling for generate_batch
  return null
}

// Tool rendering for edit_logo:
if (part.type === "tool-edit_logo") {
  // ... has output-error handling (good)
}
```

**Problems:**
- No `output-error` state handling for `generate_batch` tool
- Heavy use of `as any` for input/output access
- When parts are restored from DB, the `type` field is `"tool-generate_batch"` (correct for v6 typed tool parts), but the stored `state`/`input`/`output` fields may not match

### Nanobanana Prompt Engineering Patterns (from `.agents/skills/nanobanana/references/prompts.md`)

Key patterns to adopt in system prompt:

```
# Structured prompt format
Subject + Style + Details + Quality

# Quality modifiers
"high resolution", "4K quality", "ultra detailed", "sharp focus", "crisp details"
"professional quality", "studio quality", "commercial grade"
"consistent style", "cohesive aesthetic", "unified color palette"

# Negative concepts (avoid "no X", instead describe what you want)
Instead of "no text" → "clean image without text, pure visual"
Instead of "no people" → "empty scene, unpopulated environment"

# Logo-specific patterns from styles.md
"Minimalist {subject} logo, flat design, clean lines, {color} on white background, simple geometric shapes"
"Pixel art {subject} logo, 8-bit retro style, black pixels on white background, 32x32 grid"
```

### AI SDK v6 Best Practices (from research)

**Tool definition — use `inputSchema` not `parameters`:**
```typescript
// Some v6 versions have a bug where `parameters` is ignored
tool({
  inputSchema: z.object({ ... }),  // ✅ correct for v6
})
```

**Message persistence — official pattern:**
```typescript
// Server: use createUIMessageStream + onFinish with responseMessage
const stream = createUIMessageStream({
  execute: ({ writer }) => {
    const result = streamText({ model, messages, tools });
    writer.merge(result.toUIMessageStream({ sendStart: false }));
  },
  onFinish: async ({ responseMessage }) => {
    // responseMessage is already a UIMessage — store its parts directly
    await db.upsertMessage({ id: responseMessage.id, parts: responseMessage.parts });
  },
});
return createUIMessageStreamResponse({ stream });
```

**Loading persisted messages — with incomplete tool call filter:**
```typescript
const modelMessages = await convertToModelMessages(messages, {
  ignoreIncompleteToolCalls: true,
});
```

**Abort handling — use consumeStream:**
```typescript
import { consumeStream } from 'ai';

return result.toUIMessageStreamResponse({
  consumeSseStream: consumeStream,  // ensures onFinish fires on abort
});
```

### Gemini Rate Limits

| Tier | IPM | Safe Concurrency |
|------|-----|-------------------|
| Tier 1 | 10 | 1-2 |
| Tier 2 | 50 | 3-5 |
| Tier 3 | 100 | 5-10 |

Retry pattern: exponential backoff 1s → 2s → 4s, max 3 retries.
Error codes: 429 (RESOURCE_EXHAUSTED), 503 (UNAVAILABLE).

---

## Testing Plan (TDD — tests first)

- [ ] **T1**: Create test file `web/src/__tests__/gemini.test.ts` — unit tests for `generateLogoImage` retry logic: mock `@google/genai` to return 429 on first call then succeed on second, verify retry with backoff
- [ ] **T2**: Create test file `web/src/__tests__/gemini.test.ts` — unit test: mock Gemini to return null candidates, verify proper error thrown (not silent null)
- [ ] **T3**: Create test file `web/src/__tests__/gemini.test.ts` — unit test: verify concurrency limiter allows max 2 concurrent calls by tracking active promise count
- [ ] **T4**: Create test file `web/src/__tests__/message-persistence.test.ts` — unit test: serialize a UIMessage with tool-invocation parts to DB format, then deserialize back, verify round-trip fidelity
- [ ] **T5**: Create test file `web/src/__tests__/message-persistence.test.ts` — unit test: deserialize DB message with `parts: null` (legacy), verify fallback to `[{ type: "text", text: content }]`
- [ ] **T6**: Create test file `web/src/__tests__/message-persistence.test.ts` — unit test: deserialize DB message with incomplete tool call (state != "output-available"), verify it's filtered out or handled
- [ ] **T7**: Install `vitest` and add test script to `package.json` if not already present — verify tests run with `npm test`

## Implementation Plan

### Phase A: Gemini API Layer (`web/src/lib/gemini.ts`)

- [ ] **A1**: Change `responseModalities` from `["IMAGE"]` to `["IMAGE", "TEXT"]` in both `generateLogoImage` and `editLogoImage` — matches nanobanana's proven stable pattern
- [ ] **A2**: Add retry with exponential backoff (max 3 retries, delays: 2s, 4s, 8s) — detect 429/503 by checking `error.status` or `error.message.includes("RESOURCE_EXHAUSTED")` or `error.message.includes("UNAVAILABLE")`
- [ ] **A3**: Change return type from `... | null` to throw on unrecoverable errors — callers should catch and return error objects to the LLM. Keep `null` only for "Gemini returned a response but no image data" (safety filter block)
- [ ] **A4**: Add a concurrency limiter: export a `withGeminiConcurrency<T>(fn: () => Promise<T>): Promise<T>` wrapper using a simple semaphore (max 2 concurrent requests) to avoid Tier 1 rate limit collisions. Implement as a module-level counter + queue, no external deps needed
- [ ] **A5**: Remove dead `batchGenerateLogos()` function — it's never called (route.ts has inline batch logic)
- [ ] **A6**: Add structured logging: log model name, retry count, latency (ms), and error codes for each API call — use `console.log` with JSON-formatted object for Vercel log search

### Phase B: Chat API Route (`web/src/app/api/chat/route.ts`)

- [ ] **B1**: Wrap image generation calls in `generate_batch` tool with the new `withGeminiConcurrency()` wrapper — changes `Promise.all(Array.from(...))` to use the semaphore, effectively limiting to 2 concurrent Gemini calls
- [ ] **B2**: Reduce `stopWhen: stepCountIs(5)` to `stepCountIs(3)` — 3 steps is sufficient (step 1: tool call, step 2: tool result → text response, step 3: safety margin for edit follow-up)
- [ ] **B3**: Add `consumeStream` import and pass `consumeSseStream: consumeStream` to `toUIMessageStreamResponse()` — ensures `onFinish` fires even when user aborts the stream
- [ ] **B4**: Add `ignoreIncompleteToolCalls: true` to `convertToModelMessages()` call — prevents "Tool results are missing" error when previous conversation had pending tool calls
- [ ] **B5**: Rewrite `onFinish` callback to use `steps` array for parts reconstruction instead of manually parsing `response.messages`. The `steps` array has typed `toolCalls` and `toolResults` that don't need `as any` casts:
  ```typescript
  onFinish: async ({ text, steps }) => {
    const parts: any[] = [];
    for (const step of steps) {
      // Text from this step
      if (step.text) parts.push({ type: "text", text: step.text });
      // Tool calls with their results
      if (step.toolCalls) {
        for (const tc of step.toolCalls) {
          const tr = step.toolResults?.find(r => r.toolCallId === tc.toolCallId);
          parts.push({
            type: `tool-${tc.toolName}`,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            state: tr ? "output-available" : "output-error",
            input: tc.args,
            output: tr?.result,
          });
        }
      }
    }
    // Deduplicate text parts (steps may have overlapping text)
    const deduped = deduplicateTextParts(parts);
    await prisma.chatMessage.create({
      data: { projectId, role: "assistant", content: text || "", parts: deduped.length > 0 ? deduped : undefined },
    });
  }
  ```
- [ ] **B6**: In `generate_batch` tool execute, make errors visible to the LLM: when all generations fail, return `{ generated: 0, total: count, logos: [], error: "All image generations failed. Possible rate limit (429) or server overload (503). Please wait 30 seconds and try again with fewer images (e.g., 3)." }` — the LLM will relay this to the user instead of saying "I generated 0/5"
- [ ] **B7**: In `edit_logo` tool execute, wrap `editLogoImage` call in try-catch and return descriptive error: `{ error: "Image editing failed: ${e.message}. Try rephrasing the edit or use a different version." }`
- [ ] **B8**: Increase `maxDuration` from 120 to 300 — allows up to 5 minutes for 5 images with retries (5 images × 25s each × up to 3 retries = ~375s worst case, but concurrency limiter reduces this)

### Phase C: Message Persistence & Restoration (`web/src/lib/chat/hooks.ts` + `web/src/app/projects/[id]/page.tsx`)

- [ ] **C1**: In `hooks.ts`, pass `initialMessages` directly to `useChat()` via the `messages` prop instead of using `setMessages()` in a `useEffect`. Remove the `initializedRef` workaround entirely:
  ```typescript
  const chat = useAIChat({
    id: projectId,
    transport,
    messages: initialMessages,  // initial-only, set at mount time
  })
  ```
- [ ] **C2**: In `hooks.ts`, add a `useEffect` that calls `setMessages()` ONLY when `initialMessages` transitions from empty to non-empty (handles the case where tRPC data loads after the hook mounts). Use a `prevLengthRef` to track:
  ```typescript
  const prevLengthRef = useRef(0)
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && prevLengthRef.current === 0 && chat.messages.length === 0) {
      chat.setMessages(initialMessages)
    }
    prevLengthRef.current = initialMessages?.length ?? 0
  }, [initialMessages])
  ```
- [ ] **C3**: In `page.tsx`, fix message reconstruction from DB to produce valid UIMessage parts. The stored parts use `type: "tool-generate_batch"` (v6 typed tool part format) — this is correct. But ensure `state`, `input`, `output` fields are present:
  ```typescript
  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!chatMessages.data) return []
    return chatMessages.data.map((msg) => {
      const dbParts = msg.parts as any[] | null
      let parts: UIMessage["parts"]
      if (dbParts && Array.isArray(dbParts) && dbParts.length > 0) {
        parts = dbParts.map(p => {
          if (p.type === "text") return { type: "text" as const, text: p.text || "" }
          if (p.type?.startsWith("tool-")) {
            return {
              type: p.type,
              toolCallId: p.toolCallId || `legacy-${msg.id}`,
              toolName: p.toolName || p.type.replace("tool-", ""),
              state: p.state || "output-available",
              input: p.input ?? {},
              output: p.output ?? {},
            }
          }
          return { type: "text" as const, text: "" }
        })
      } else {
        parts = [{ type: "text" as const, text: msg.content }]
      }
      return { id: msg.id, role: msg.role as "user" | "assistant", parts, createdAt: new Date(msg.createdAt) }
    })
  }, [chatMessages.data])
  ```

### Phase D: System Prompt Enhancement (`web/src/lib/chat/system-prompt.ts`)

- [ ] **D1**: Add a "Prompt Construction Guide" section that teaches the LLM how to write Gemini prompts using nanobanana's proven patterns. Include structured format (Subject + Style + Details + Quality) and quality modifiers:
  ```
  ## Prompt Construction for generate_batch Tool
  When constructing the `prompt` parameter for generate_batch, follow this structure:
  
  FORMAT: "{subject} logo, {style} style, {colors}, {details}, {quality modifiers}"
  
  QUALITY MODIFIERS (always append): 
  "high resolution, professional quality, clean design, sharp details"
  
  STYLE KEYWORDS by category:
  - Minimalist: "flat design, clean lines, simple geometric shapes, modern professional"
  - Pixel Art: "8-bit retro style, crisp pixels, limited color palette, sharp edges"
  - 3D: "isometric view, soft shadows, glossy finish, modern tech style"
  - Mascot: "cute character, friendly expression, cartoon style, big eyes"
  - Monogram: "modern typography, elegant design, lettermark"
  - Abstract: "geometric shapes, interconnected patterns, contemporary style"
  
  NEGATIVE CONCEPTS (use positive framing):
  - Instead of "no text": "clean image without text, pure visual symbol"
  - Instead of "no background": "isolated on white background, clean cutout"
  - Instead of "not complex": "ultra simple, minimal elements"
  
  EXAMPLE PROMPT:
  "Minimalist 'Acme' tech startup logo, flat design, electric blue on white background, 
  geometric letter A with circuit pattern, clean lines, modern professional, 
  high resolution, sharp details, suitable for app icon"
  ```
- [ ] **D2**: Add a "Tool Call Strategy" section instructing the LLM to NOT retry automatically on failure — instead, explain the error to the user and ask them if they want to retry or adjust:
  ```
  ## Tool Call Strategy
  - When generate_batch returns { error: "..." }, do NOT call the tool again immediately
  - Instead, explain the error to the user in plain Korean and suggest:
    1. Wait 30 seconds and try again
    2. Reduce the number of variations (e.g., 3 instead of 5)
    3. Simplify the prompt
  - When generate_batch returns { generated: N, total: M } where N < M, tell the user 
    exactly how many succeeded and offer to generate the remaining ones
  ```
- [ ] **D3**: Add batch count guidance: instruct the LLM to default to 5 but suggest 3 if the user seems to be in a hurry or if a previous batch had failures

### Phase E: Chat Panel UI (`web/src/components/chat-panel.tsx`)

- [ ] **E1**: Add `output-error` state handling for `generate_batch` tool part — display a red error message with retry suggestion:
  ```tsx
  if (part.state === "output-error") {
    return (
      <div key={i} className="mt-2 space-y-1.5">
        <div className="text-xs text-red-400">✗ 로고 생성 실패</div>
        <div className="text-[10px] text-[#555]">잠시 후 다시 시도해주세요</div>
      </div>
    )
  }
  ```
- [ ] **E2**: Type-safe access to tool part input/output — create a helper type to avoid `as any`:
  ```typescript
  type ToolPartData = {
    input?: Record<string, unknown>
    output?: Record<string, unknown>
    state: string
    toolCallId: string
    toolName: string
  }
  function getToolData(part: any): ToolPartData {
    return {
      input: part.input ?? {},
      output: part.output ?? {},
      state: part.state ?? "input-available",
      toolCallId: part.toolCallId ?? "",
      toolName: part.toolName ?? part.type?.replace("tool-", "") ?? "",
    }
  }
  ```
- [ ] **E3**: When `generate_batch` output shows `generated > 0` but `generated < total`, show partial success message: "✓ {generated}/{total}개 생성 (일부 실패). 갤러리에서 확인하세요 →"

---

## Parallelization Plan

### Batch 1 (parallel — no file overlap)
- [ ] **Coder A**: Tasks T1-T3, A1-A6 → files: `web/src/lib/gemini.ts`, `web/src/__tests__/gemini.test.ts`
- [ ] **Coder B**: Tasks D1-D3 → files: `web/src/lib/chat/system-prompt.ts`

### Batch 2 (after Batch 1 — depends on gemini.ts changes)
- [ ] **Coder C**: Tasks T4-T7, B1-B8 → files: `web/src/app/api/chat/route.ts`, `web/src/__tests__/message-persistence.test.ts`, `web/package.json` (test script only)
- [ ] **Coder D**: Tasks C1-C3 → files: `web/src/lib/chat/hooks.ts`, `web/src/app/projects/[id]/page.tsx`

### Batch 3 (after Batch 2 — depends on route.ts parts format)
- [ ] **Coder E**: Tasks E1-E3 → files: `web/src/components/chat-panel.tsx`

### Dependencies
- **Batch 2 depends on Batch 1**: `route.ts` imports `withGeminiConcurrency` from `gemini.ts` (Coder C needs Coder A's output); `page.tsx` parts format must match `route.ts` onFinish output (Coder D needs Coder C's schema)
- **Batch 3 depends on Batch 2**: `chat-panel.tsx` renders parts produced by `route.ts` onFinish → must match the parts format from B5
- **Coder A and Coder B are independent**: gemini.ts and system-prompt.ts have no imports from each other
- **Coder C and Coder D can run in parallel within Batch 2**: route.ts and hooks.ts/page.tsx are independent files. The parts format from B5 is documented above so Coder D can reference it

### Risk Areas
- **Parts format compatibility**: The stored parts format (from `onFinish` in B5) must exactly match what `page.tsx` (C3) and `chat-panel.tsx` (E1-E3) expect. The format is: `{ type: "tool-{toolName}", toolCallId, toolName, state, input, output }` for tool parts and `{ type: "text", text }` for text parts
- **`useChat` messages prop vs setMessages race**: C1 and C2 together handle both the "data available at mount" and "data arrives after mount" cases. Must test both scenarios
- **Gemini concurrency limiter**: A4's semaphore implementation must be thread-safe in Node.js single-threaded async context — use a simple counter + queue pattern (no need for actual mutex)
- **vitest config**: T7 assumes vitest is not installed. If it is, skip installation. Check `package.json` devDependencies first

---

## Done Criteria

- [ ] All tests pass (`npm test` exits 0)
- [ ] `npm run build` succeeds with no type errors
- [ ] Gemini image generation succeeds with retry on 429/503 (verifiable via unit tests)
- [ ] Concurrency limiter caps parallel Gemini calls at 2 (verifiable via unit tests)
- [ ] Chat messages persist across page refresh (manual verification on deployed app)
- [ ] Tool call progress (generating/complete/error) renders correctly in chat panel
- [ ] `generate_batch` failure produces user-visible error message instead of silent "0/5"
- [ ] System prompt produces well-structured Gemini prompts with quality modifiers
- [ ] No `as any` casts remain in hot paths (gemini.ts, route.ts onFinish, chat-panel.tsx tool rendering)
- [ ] Dead code `batchGenerateLogos()` removed from gemini.ts
- [ ] Vercel production deploy succeeds
