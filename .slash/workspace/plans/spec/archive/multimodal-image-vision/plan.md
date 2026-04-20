---
created: 2026-04-19T00:00:00Z
last_updated: 2026-04-19T00:00:00Z
type: spec
change_id: multimodal-image-vision
status: code-complete
trigger: "multimodal-image-vision 스펙 구현해줘 — LLM 비전 + 첨부 이미지 Blob 업로드 + referenceImageUrls + view_logo tool"
---

# Plan: Multimodal Image Vision (LLM vision + attachment Blob pipeline + reference images + view_logo tool)

## Background & Research

### Spec intent (from `openspec/changes/multimodal-image-vision/`)
- Pass user-attached images to LLM as OpenRouter `image_url` content parts for auto-analysis.
- Resize attachments server-side with `sharp` (512px max long edge, WebP) and upload to Vercel Blob; DB stores Blob URL instead of base64.
- Add `referenceImageUrls` param to `generate_batch` tool; Gemini call includes them as `inlineData`.
- Add new `view_logo` tool that returns gallery logo as `image_url` tool-result part.
- Enforce 5-images-per-turn safety limit (keep 5 most recent).
- Backward compatibility: parsing must handle both base64 data URLs and Blob URLs in file parts.

### Current state (key files)

**`web/package.json` dependencies** — `sharp@^0.34.5` is already installed, `@google/genai@^1.49.0`, `@vercel/blob@^2.3.3`, `ai@^6.0.158`, `@openrouter/ai-sdk-provider@^2.5.1`. Task 1.1 (install sharp) is largely a no-op; `@types/sharp` is NOT needed (sharp ships its own types since 0.33+). Action: verify `sharp` is installed — no new install needed.

**`web/src/lib/storage.ts`** (FULL FILE — 32 lines):
```ts
import { put, del } from "@vercel/blob"

export function getStorageKey(
  userId: string,
  projectId: string,
  logoId: string,
  versionId: string,
  ext = "png"
) {
  return `users/${userId}/projects/${projectId}/logos/${logoId}/${versionId}.${ext}`
}

export async function uploadImage(
  key: string,
  body: Buffer,
  contentType = "image/png"
): Promise<string> {
  const blob = await put(key, body, {
    access: "public",
    contentType,
  })
  return blob.url
}

export async function deleteImage(url: string) {
  await del(url)
}

export function getDownloadUrl(url: string): string {
  return url
}
```

**`web/src/lib/gemini.ts` — editLogoImage pattern (template for reference image)**:
```ts
export async function editLogoImage(
  prompt: string,
  sourceImageBuffer: Buffer,
  sourceMimeType = "image/png"
): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  const ai = getClient()
  const base64 = sourceImageBuffer.toString("base64")
  // ...
  return await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      { inlineData: { mimeType: sourceMimeType, data: base64 } },
      prompt,
    ],
    config: { responseModalities: ["IMAGE", "TEXT"] },
  })
}
```
Same `contents: [...inlineDataParts, prompt]` pattern is how we will inject reference images into `generateLogoImage`.

**`web/src/lib/gemini.ts` — current generateLogoImage signature** (extend this):
```ts
export async function generateLogoImage(
  prompt: string,
  options: { aspectRatio?: string } = {}
): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  const ai = getClient()
  // ...
  return await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,  // <-- currently just string, needs to become array when reference images present
    config: {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: { aspectRatio: aspectRatio as AspectRatio },
    },
  })
}
```

**`web/src/app/api/chat/route.ts`** — user-message persistence (line ~85-106):
```ts
const lastUserMsg = messages[messages.length - 1]
if (lastUserMsg?.role === "user") {
  const textContent = lastUserMsg.parts
    ?.filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("") ?? ""
  const hasFileParts = lastUserMsg.parts?.some((p: any) => p.type === "file")
  await prisma.chatMessage.create({
    data: {
      projectId,
      role: "user",
      content: textContent || (hasFileParts ? "(이미지 첨부)" : ""),
      parts: JSON.parse(JSON.stringify(lastUserMsg.parts)),
    },
  })
}
```
**Critical**: this is BEFORE `streamText`, so we must do the upload step and MUTATE `lastUserMsg.parts` (replacing base64 data URLs with Blob URLs) BEFORE this block runs — so DB gets Blob URLs and the LLM sees Blob URLs.

**`web/src/app/api/chat/route.ts`** — `convertToModelMessages` call (line 111):
```ts
const result = streamText({
  model: openrouter(modelName),
  system: systemPrompt,
  messages: convertToModelMessages(messages, { ignoreIncompleteToolCalls: true }),
  tools: { generate_batch: tool({...}), edit_logo: tool({...}) },
  stopWhen: stepCountIs(3),
  onFinish: async ({ text, steps }) => { ... },
})
```
AI SDK v6's `convertToModelMessages` already maps UIMessage file parts into provider format. With `@openrouter/ai-sdk-provider` the file parts become `{ type: "image", image: url }` in ModelMessage and the provider serializes to OpenRouter's `content[].type: "image_url"`. We need to verify this round-trip on a Blob URL (preferred) and on a base64 data URL (backward compat).

**`web/src/app/api/chat/route.ts`** — `generate_batch` tool execute body (line ~113-212):
```ts
generate_batch: tool({
  description: "Generate a batch of logo variations...",
  inputSchema: z.object({
    prompt: z.string(),
    count: z.number().min(1).max(20).default(5),
    aspectRatio: z.string().default("1:1"),
  }),
  execute: async ({ prompt, count, aspectRatio }) => {
    // loop:
    const result = await withGeminiConcurrency(() => generateLogoImage(prompt, { aspectRatio }))
    // create logo+version, upload to blob, push to logos[]
  },
})
```

**`web/src/app/api/chat/route.ts`** — `edit_logo` tool's source-image-fetch pattern (line ~260-270), reused for reference-image download:
```ts
const imgRes = await fetch(sourceVersion.imageUrl)
if (!imgRes.ok) return { error: `Failed to load...` }
const sourceBuffer = Buffer.from(await imgRes.arrayBuffer())
```

**`web/src/lib/chat/parse-messages.ts` — file part handling (line 38-40)**:
```ts
if (part.type === "file") {
  validatedParts.push({ type: "file", mediaType: part.mediaType, url: part.url, data: part.data })
}
```
Already accepts both `url` and `data` — backward-compatible by design. We may still need to tighten so it passes through whichever exists.

**`web/src/lib/chat/system-prompt.ts`** — 88 lines, built by `buildSystemPrompt({ projectName, logoCount })`. Currently covers interview flow, prompt construction, tool-call strategy, modification requests, language. **No vision instructions** — must append new section.

**`web/src/components/chat-panel.tsx`** — `submitMessage()` (lines 163-175) currently reads files client-side with `FileReader.readAsDataURL(file)` and sends `{ type: "file", mediaType, url: dataURL }`. **No change required** for this plan — the server will do resize+upload on receipt. (The `url` field of the file part arrives as a base64 data URL; server intercepts and replaces.)

**Prisma `ChatMessage` model** — `parts Json?` — no migration needed; we just store Blob URLs in the `url` field of file parts.

### Parts type contract going forward
- **Incoming from client**: `{ type: "file", mediaType: "image/png" | "image/jpeg" | ..., url: "data:...base64,..." }`
- **After server intake**: `{ type: "file", mediaType: "image/webp", url: "https://...blob.vercel-storage.com/..." }`
- **Legacy in DB**: `{ type: "file", mediaType, url: "data:..." | "https://...", data?: "data:..." }` — parser and LLM converter must handle both.

### Vision conversion reference (OpenRouter format via AI SDK v6)
AI SDK v6 UIMessage file part → ModelMessage content part `{ type: "image", image: string | URL }`. `@openrouter/ai-sdk-provider` serializes to OpenRouter multimodal payload `{ type: "image_url", image_url: { url } }` automatically. No manual JSON construction required if `convertToModelMessages` handles file parts — but the spec requires **text-first, image-after ordering** (ai-chat-engine spec scenario "Message with images sent to LLM"). Need to verify ordering behavior of `convertToModelMessages` on mixed parts; if it doesn't text-first, we pre-reorder `lastUserMsg.parts` before conversion.

### 5-image safety limit
Spec says max 5 images **per LLM turn** (aggregated across current conversation window sent to LLM). Implementation: after Blob-upload step, walk `messages` array, count file parts, if >5 keep the 5 most-recent (iterate from end). Apply this to the `messages` array that is passed to `convertToModelMessages`, NOT to DB persistence (DB keeps everything).

### `view_logo` tool — tool-result content shape (AI SDK v6)
AI SDK v6 tools can return multi-part content via `experimental_toToolResultContent` option or by returning an array of content parts. Pattern:
```ts
view_logo: tool({
  inputSchema: z.object({ logoOrderIndex: z.number(), versionNumber: z.number().optional() }),
  execute: async ({ logoOrderIndex, versionNumber }) => {
    // fetch logo+version from DB (matching pattern in edit_logo tool)
    return {
      logoIndex: logoOrderIndex,
      versionNumber: v.versionNumber,
      imageUrl: v.imageUrl,
      createdAt: v.createdAt,
      versionCount: logo.versions.length,
    }
  },
  experimental_toToolResultContent: (result) => {
    if ("error" in result) return [{ type: "text", text: result.error }]
    return [
      { type: "text", text: `Logo #${result.logoIndex} v${result.versionNumber}` },
      { type: "image", image: new URL(result.imageUrl) },
    ]
  },
}),
```
Referenced by spec `image-vision/spec.md` Requirement "view_logo tool". If `experimental_toToolResultContent` API shape differs in installed `ai@^6.0.158`, fall back to returning a content-parts array directly from execute. Confirm at implementation time by reading `node_modules/ai/dist/index.d.ts` for `tool()` signature.

### Gemini Tier 1 rate limit constraint
`withGeminiConcurrency` caps parallel Gemini calls at 2. Reference image download happens BEFORE the Gemini call — download outside the concurrency gate. Pattern:
```ts
// In generate_batch execute:
const refBuffers = referenceImageUrls
  ? await Promise.all(referenceImageUrls.map(async (u) => {
      const r = await fetch(u)
      const buf = Buffer.from(await r.arrayBuffer())
      const mimeType = r.headers.get("content-type") ?? "image/webp"
      return { buf, mimeType }
    }))
  : undefined
// then inside the generate loop:
const result = await withGeminiConcurrency(() => generateLogoImage(prompt, { aspectRatio, referenceImages: refBuffers }))
```

## Testing Plan (TDD — tests first)

The Splash repo has no unit-test harness configured in `web/package.json` (no jest/vitest scripts). Per AGENTS.md the verification pattern is `pnpm build` + manual end-to-end checks. We will therefore define **verification scripts** (runnable via `ts-node`/`tsx` in an ad-hoc `tmp-tests/` folder, NOT committed as real unit tests) and **manual scenario checklists**. If there is a tsx runner already, use it; otherwise these are curl-style checklist items executed after build.

- [ ] T1. Write `tmp-tests/test-resize.ts` script: call `resizeAndUploadImage(smallDataUrl)` with a 200×200 PNG base64 → assert returned URL is a Blob URL and that re-fetching yields a WebP whose bytes decode to ≤ 200px on long edge.
- [ ] T2. Extend `tmp-tests/test-resize.ts`: feed a 3000×2000 PNG base64 → assert returned WebP is 512×341 (±1) and Content-Type is `image/webp`.
- [ ] T3. Write `tmp-tests/test-parse-messages.ts`: parse a ChatMessage with legacy base64 file part and assert `parseInitialMessages` output has `url` starting with `data:`.
- [ ] T4. Extend T3: parse a ChatMessage with new Blob URL file part and assert `url` starts with `https://` and `data` is undefined (or preserved as-is).
- [ ] T5. Write `tmp-tests/test-reorder-parts.ts`: given a parts array `[file, file, text]`, verify the reorder helper outputs `[text, file, file]` (text-first for vision).
- [ ] T6. Write `tmp-tests/test-image-limit.ts`: given 7 file parts across 3 messages, verify the limit helper retains the 5 most recent by array-tail order.
- [ ] T7. Scenario checklist (manual via running app):
  - [ ] a. Attach a single image, send "이 이미지 분석해줘" → assistant replies with analysis mentioning colors/style/mood.
  - [ ] b. Attach image, send "이 느낌으로 로고 만들어줘" → LLM calls `generate_batch` with `referenceImageUrls` populated; generated logos visibly reflect reference palette.
  - [ ] c. With 2 prior logos in gallery, send "3번 로고 어떻게 보여?" → LLM calls `view_logo` (or replies that logo #3 doesn't exist if only 2 exist); if it exists, description matches the image.
  - [ ] d. Send 7 images in a single user turn → backend logs show exactly 5 images forwarded to LLM.
  - [ ] e. Inspect DB: confirm `ChatMessage.parts` for new user messages contain `url: "https://...blob.vercel-storage.com/..."` (not `data:`).
  - [ ] f. Load a legacy project with base64-parts messages: images still render correctly in chat panel (backward compat).
- [ ] T8. Verification: `pnpm build` in `web/` passes TypeScript + Next build.

## Implementation Plan

Order is strict TDD: helpers and parsers first (T1-T6 in parallel with their implementations), then wiring, then system prompt, then verification.

### 1. Storage — `resizeAndUploadImage` helper (task 1.2)
- [ ] I1.1 Verify `sharp` installed: `grep '"sharp"' web/package.json` — if absent, run `pnpm add sharp` in `web/`. (`@types/sharp` NOT required on sharp ≥0.33.) → files: `web/package.json` (only if missing).
- [ ] I1.2 Add `resizeAndUploadImage(dataUrl: string, projectId: string, userId: string): Promise<{ url: string; mediaType: "image/webp" }>` to `web/src/lib/storage.ts`:
  - Parse data URL header to extract declared mimeType; strip `data:...;base64,` prefix; `Buffer.from(..., "base64")`.
  - `sharp(buffer).rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()`.
  - Key: `users/${userId}/projects/${projectId}/attachments/${cuid}.webp` (new prefix `attachments/`; mirror existing key pattern).
  - Call existing `put(key, resized, { access: "public", contentType: "image/webp" })`; return `{ url: blob.url, mediaType: "image/webp" }`.
  - Export alongside `uploadImage`, `deleteImage`, `getStorageKey`.
- [ ] I1.3 Handle non-data-URL inputs defensively: if `dataUrl` already starts with `http`, return `{ url: dataUrl, mediaType: inferredOrFallback }` unchanged (idempotent for replays/reloads).

### 2. Parse messages — backward-compat tightening (task 2.2)
- [ ] I2.1 In `web/src/lib/chat/parse-messages.ts`, keep current file-part handling but ensure `url` passes through unchanged whether it's `data:` or `https:`. Add a `data` fallback: if `url` missing but `data` present, copy `data` into `url` so consumers have one source of truth. Leave legacy `data` field in output for backward-compat.

### 3. Helpers for message transformation (tasks 3.1, 3.2)
- [ ] I3.1 Create `web/src/lib/chat/vision-utils.ts` with:
  - `reorderPartsTextFirst(parts: UIMessagePart[]): UIMessagePart[]` — stable sort: non-file parts before file parts.
  - `limitImagesPerTurn(messages: UIMessage[], maxImages = 5): UIMessage[]` — iterate messages oldest→newest, count file parts, when count exceeds `maxImages` drop oldest file parts (not whole messages); return a new array with a shallow clone of any mutated message.
  - `extractFilePartsFromLastUserMessage(messages: UIMessage[]): { message: UIMessage; fileParts: Array<{ index: number; url: string; mediaType: string }> } | null` — used by the server upload step.

### 4. Chat route — attachment upload + LLM vision wiring (tasks 2.1, 3.1, 3.2)
- [ ] I4.1 In `web/src/app/api/chat/route.ts`, immediately after parsing request body and before the "save user message to DB" block (~line 85), add a loop over `messages[messages.length-1].parts` (guarded by role==="user"):
  - For each file part whose `url` starts with `data:`, call `resizeAndUploadImage(url, projectId, userId)` and replace both `url` and `mediaType` on the part in place. Log (`console.log` JSON) per-upload success/failure.
  - Fail-soft: if upload throws, keep the original data URL (so persistence still works) and `console.error`.
- [ ] I4.2 After step I4.1, the existing `prisma.chatMessage.create({ data: { ..., parts: JSON.parse(JSON.stringify(lastUserMsg.parts)) } })` will now persist Blob URLs. No code change there besides ensuring the mutation happens before serialization.
- [ ] I4.3 Build the LLM messages: before `convertToModelMessages(messages, ...)`, apply `limitImagesPerTurn(messages, 5)` then map each user message's parts through `reorderPartsTextFirst`. Assign result to a new `const llmMessages`.
- [ ] I4.4 Replace `messages: convertToModelMessages(messages, { ignoreIncompleteToolCalls: true })` with `messages: convertToModelMessages(llmMessages, { ignoreIncompleteToolCalls: true })`.

### 5. `view_logo` tool (task 4.1)
- [ ] I5.1 In `web/src/app/api/chat/route.ts`, add a new tool after `edit_logo` inside the `tools: { ... }` object:
  - `inputSchema: z.object({ logoOrderIndex: z.number().int().min(1), versionNumber: z.number().int().min(1).optional() })`.
  - `execute`: Query `prisma.logo.findFirst({ where: { projectId, orderIndex: logoOrderIndex - 1 }, include: { versions: { orderBy: { versionNumber: "desc" } } } })`. If not found, return `{ error: ... }`. Select version matching `versionNumber` or `versions[0]`. Return `{ logoIndex, versionNumber, imageUrl, createdAt, versionCount, aspectRatio }`.
  - `experimental_toToolResultContent` (or the equivalent in installed AI SDK v6): return `[{ type: "text", text: "Logo #{i} v{n} ({aspectRatio}, created {date}) — {count} versions total" }, { type: "image", image: new URL(imageUrl) }]`. Error case returns text-only.
- [ ] I5.2 If installed `ai` version doesn't expose `experimental_toToolResultContent` in the `tool()` options, read `node_modules/ai/dist/index.d.ts` for the exact option name (might be `toModelOutput` in ai@6) and adapt; else return a raw content-parts array from `execute`. Confirm via build step that typecheck passes.

### 6. `generate_batch` — reference images (tasks 5.1, 5.2, 5.3)
- [ ] I6.1 In `web/src/app/api/chat/route.ts`, extend `generate_batch.inputSchema` to add `referenceImageUrls: z.array(z.string().url()).max(5).optional().describe("Blob URLs of reference images from user attachments or gallery logos")`.
- [ ] I6.2 In `generate_batch.execute`, before the loop, if `referenceImageUrls?.length` is non-zero, download each URL with `fetch`, build `referenceImages: Array<{ data: string /*base64*/; mimeType: string }>` (base64 so downstream Gemini call can consume without re-download per iteration).
- [ ] I6.3 Pass `referenceImages` into each loop iteration: `withGeminiConcurrency(() => generateLogoImage(prompt, { aspectRatio, referenceImages }))`.
- [ ] I6.4 In `web/src/lib/gemini.ts`, change `generateLogoImage` signature to:
  ```ts
  export async function generateLogoImage(
    prompt: string,
    options: {
      aspectRatio?: string
      referenceImages?: Array<{ data: string /* base64, no prefix */; mimeType: string }>
    } = {}
  ): Promise<{ imageBuffer: Buffer; mimeType: string } | null>
  ```
- [ ] I6.5 Inside `generateLogoImage`, when `referenceImages?.length`, build `contents` as an array: `[...referenceImages.map(r => ({ inlineData: { mimeType: r.mimeType, data: r.data } })), prompt]`. Otherwise keep current `contents: prompt` behavior (no regressions). Mirror the `editLogoImage` pattern exactly.
- [ ] I6.6 Keep `responseModalities: ["IMAGE", "TEXT"]` and `imageConfig.aspectRatio` — confirm Gemini accepts `imageConfig.aspectRatio` alongside reference image inlineData (per AGENTS.md `gemini-3-pro-image-preview` supports both).

### 7. System prompt — vision instructions (task 6.1)
- [ ] I7.1 In `web/src/lib/chat/system-prompt.ts`, append a new section near the end (before the language instruction) titled "## Vision & Image Analysis":
  - Instruct: when user attaches images, BEFORE anything else provide a brief per-image analysis (colors, style, composition, mood) in the context of logo design.
  - Instruct: when user gives attached image + request like "이 느낌으로 만들어줘", call `generate_batch` with `referenceImageUrls` set to the attached image URLs.
  - Instruct: when user asks about a specific gallery logo ("3번 로고 보여봐"), call `view_logo` with the order index; DO NOT assume its appearance.
  - Constraint: max 5 images per conversation turn are visible to you; older images are truncated.
  - Constraint: reference images passed to `generate_batch` must be URLs that came from the current conversation context (user attachment URLs or `view_logo` tool outputs).
- [ ] I7.2 Keep current interview/prompt-construction sections intact.

### 8. Verification (task 7)
- [ ] I8.1 Run `pnpm build` in `web/` — expect clean TypeScript and Next build.
- [ ] I8.2 Execute scenario checklist T7.a–T7.f manually against a local `pnpm dev` instance. Capture screenshots or console logs as needed.
- [ ] I8.3 Tick off the corresponding items in `openspec/changes/multimodal-image-vision/tasks.md` — 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 5.1, 5.2, 5.3, 6.1, 7.1, 7.2, 7.3, 7.4.

## Parallelization Plan

### Batch 1 (parallel — pure-helpers, no cross-file deps)
- [ ] Coder A: I1.1, I1.2, I1.3 → files: `web/src/lib/storage.ts`, `web/package.json` (only if `sharp` absent).
- [ ] Coder B: I3.1 (vision-utils) → files: `web/src/lib/chat/vision-utils.ts` (new file).
- [ ] Coder C: I2.1 (parse-messages tighten) → files: `web/src/lib/chat/parse-messages.ts`.
- [ ] Coder D: I7.1, I7.2 (system prompt) → files: `web/src/lib/chat/system-prompt.ts`.
- [ ] Coder E: I6.4, I6.5, I6.6 (gemini referenceImages) → files: `web/src/lib/gemini.ts`.

### Batch 2 (after Batch 1 — integrates everything in chat route)
- [ ] Coder F: I4.1–I4.4 (attachment upload + LLM vision wiring), I5.1–I5.2 (view_logo tool), I6.1–I6.3 (generate_batch referenceImageUrls) → files: `web/src/app/api/chat/route.ts` ONLY.

### Batch 3 (after Batch 2 — verification)
- [ ] Coder G: I8.1 (`pnpm build`), I8.2 (manual scenarios), I8.3 (tick off OpenSpec tasks.md) → files: none (build + manual) + `openspec/changes/multimodal-image-vision/tasks.md` (checkbox edits only).

### Dependencies
- Batch 2 depends on Batch 1 because `route.ts` imports `resizeAndUploadImage` (A), `vision-utils` (B), updated `generateLogoImage` (E), and the new system prompt text (D). Parse-messages (C) is read by the chat hook / page layouts, not `route.ts`, but separating keeps file boundaries clean.
- Batch 3 depends on Batch 2 because the full pipeline must compile before we can build or run manual scenarios.

### Risk Areas
- **AI SDK v6 tool content-part API**: `experimental_toToolResultContent` naming may differ in `ai@6.0.158`. If build fails on Coder F's `view_logo`, read `node_modules/ai/dist/index.d.ts` and adapt — may be `toModelOutput` or returning a content-parts array from `execute` directly.
- **`convertToModelMessages` + OpenRouter provider image handling**: verify that a UIMessage file part with `url: "https://...blob..."` reaches OpenRouter as `image_url`. If the provider instead expects `{ type: "image", image: URL }` in UIMessage parts, we may need to pre-map file parts to image parts before conversion. Empirically validate in manual test T7.a.
- **Korean IME / part ordering**: our reorder helper moves all non-file parts before file parts; for user messages this gives "text first, images after" as spec requires. Double-check text part ordering is preserved stable.
- **5-image limit across messages vs. within one message**: spec says "per LLM turn" (i.e., the whole `messages` array sent in this request). Our helper counts globally across messages — correct interpretation.
- **Reference image base64 re-download cost**: we download once per tool call (not per iteration inside the batch) — confirmed.
- **Vercel Blob token on local dev**: `BLOB_READ_WRITE_TOKEN` must be present in `.env`. If missing in dev, `resizeAndUploadImage` will throw — fail-soft path keeps base64 and warns, so tests can still run without token (but T7.e must be done against a deployment or with a token set).
- **Backward compat**: existing `ChatMessage` records with `url: "data:..."` must still render. Parse-messages already preserves both fields. LLM turns that include legacy messages will forward base64 data URLs as `image_url` (OpenRouter accepts both forms).
- **File boundary overlap**: `route.ts` is edited exclusively by Coder F in Batch 2. No other agent touches `route.ts`. `storage.ts`, `gemini.ts`, `system-prompt.ts`, `parse-messages.ts`, and the new `vision-utils.ts` each belong to exactly one coder in Batch 1.

## Done Criteria
- [ ] All Batch 1, Batch 2, Batch 3 tasks checked.
- [ ] `pnpm build` in `web/` succeeds with no TS errors.
- [ ] Manual scenarios T7.a–T7.f pass.
- [ ] `ChatMessage.parts` for newly sent messages store Blob URLs (verified via Prisma Studio or DB query).
- [ ] Legacy base64 messages still render (backward-compat scenario).
- [ ] OpenSpec tasks checked: `openspec/changes/multimodal-image-vision/tasks.md` items 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 5.1, 5.2, 5.3, 6.1, 7.1, 7.2, 7.3, 7.4.
