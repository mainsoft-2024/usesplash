---
created: 2026-04-22T00:00:00Z
last_updated: 2026-04-22T00:00:00Z
type: spec
change_id: chat-logo-mention
status: pending
trigger: "Apply OpenSpec change chat-logo-mention — structured @-mention chips for logo versions in chat composer + gallery, multi-mention, validated server-side, images injected to LLM, edit_logo gains referencedVersions + outputMode."
---

# Plan: chat-logo-mention — Structured Logo Version Mentions

## Background & Research

### Stack touch points
- **Frontend**: Next.js 15 App Router, React, Tailwind v4, AI SDK v6 (`@ai-sdk/react` `useChat`, `DefaultChatTransport`).
- **Backend**: `web/src/app/api/chat/route.ts` (571 lines) — POST handler, tool definitions, onFinish persistence.
- **Image gen**: `web/src/lib/gemini.ts` — `editLogoImage(prompt, sourceImageBuffer, sourceMimeType?)`; `generateLogoImage` already supports `referenceImages` array (pattern to mirror).
- **DB**: Prisma 7 / Neon. `ChatMessage.parts` is `Json?` → mention parts persist with zero migration. `Logo.orderIndex` is 0-based in DB (display `orderIndex + 1`). `LogoVersion.imageUrl` is canonical image URL.
- **Tests**: vitest + `@testing-library/react` configured. Existing tests: `web/src/app/api/chat/route.test.ts`, `web/src/lib/gemini.test.ts`. Playwright configured (`web/playwright.config.ts`).
- **State libs present today**: NONE (no zustand, no cmdk, no toast lib, no Radix). Adding:
  - `cmdk` (spec mandate, ~5KB) for the picker.
  - `zustand` (spec design) for `composerStore` + `gallerySpotlightStore`.
  - `sonner` (for cap-at-3 toast). Mount `<Toaster />` in `web/src/app/providers.tsx`.

### Key code snippets (embed here so coders don't re-read files)

**1. Current `useProjectChat.sendMessage` — `web/src/lib/chat/hooks.ts:46-58`**
```ts
const sendMessage = useCallback(
  (content: string, fileParts?: Array<{ type: "file"; mediaType: string; url: string }>) => {
    if (fileParts?.length) {
      chat.sendMessage({
        role: "user",
        parts: [{ type: "text" as const, text: content }, ...fileParts],
      })
    } else {
      chat.sendMessage({ text: content })
    }
  },
  [chat]
)
```
→ Extend signature to `(content, fileParts?, mentionParts?)`. When `mentionParts?.length`, append them after `text`/`file` parts in the user message. Preserve the simple `{ text }` fast path only when neither list is present.

**2. Current composer `submitMessage` — `web/src/components/chat-panel.tsx:163-175`**
```ts
const submitMessage = useCallback(async () => {
  if (chat.isLoading) return
  const content = chat.input.trim()
  const hasFiles = attachedFiles.length > 0
  if (!content && !hasFiles) return
  const fileParts = hasFiles ? await convertFilesToDataURLParts(attachedFiles) : undefined
  chat.sendMessage(content, fileParts)
  chat.setInput("")
  if (inputRef.current) inputRef.current.style.height = "auto"
  clearAttachedFiles()
}, [attachedFiles, chat, clearAttachedFiles, convertFilesToDataURLParts])
```
→ Read `composerStore.mentionsByProject[projectId]` inside; transform to `LogoMentionPart[]`; pass as 3rd arg; call `composerStore.clear(projectId)` on success.

**3. Current IME-safe onKeyDown — `chat-panel.tsx:427-435`**
```ts
onKeyDown={(e) => {
  if (e.nativeEvent.isComposing || ("isComposing" in e && e.isComposing)) return
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    if ((chat.input.trim() || attachedFiles.length > 0) && !chat.isLoading) {
      void submitMessage()
    }
  }
}}
```
→ Add: when `Backspace` pressed AND textarea `selectionStart === 0 && selectionEnd === 0` AND `!isComposing` AND chips exist → `e.preventDefault()`, remove last chip from composerStore.

**4. Current segment builder for messages — `chat-panel.tsx:35-67`**
```ts
function buildSegments(parts: UIMessage["parts"]): Segment[] {
  if (!parts?.length) return []
  const segments: Segment[] = []
  let textBuf = ""
  const flushText = () => {
    if (textBuf.length > 0) { segments.push({ kind: "text", content: textBuf }); textBuf = "" }
  }
  parts.forEach((part, index) => {
    if (part.type === "text") { textBuf += part.text; return }
    if (part.type === "file") {
      flushText()
      segments.push({ kind: "image", url: ((part as any).url || (part as any).data) as string, mediaType: (part as any).mediaType as string })
      return
    }
    flushText()
    segments.push({ kind: "tool", part, index })
  })
  flushText()
  return segments
}
```
→ Add new branch: `if (part.type === "data-mention") { flushText(); segments.push({ kind: "mention", data: (part as any).data, index }) }`. Extend `Segment` union with `{ kind: "mention"; data: LogoMentionData; index: number }`. Render above text in the history.

**5. Gallery version card — insertion point for "@ 인용" — `gallery-panel.tsx:156-212`**
```tsx
<div className="relative bg-white cursor-pointer aspect-square overflow-hidden" onClick={() => setModalIdx(idx)}>
  <img src={ver.imageUrl} alt="" className="w-full h-full object-contain" />
  {/* Top-left badge */}
  <span className={`absolute top-2 left-2 ...`}>#{logo.orderIndex + 1}{isRev ? ` · v${ai}` : ""}</span>
  {/* ... */}
  {hasRevs && (<>
    <button /* ▲ */ className="absolute top-1.5 right-2 ... opacity-0 group-hover:opacity-100 transition-opacity">▲</button>
    <button /* ▼ */ className="absolute bottom-1.5 right-2 ... opacity-0 group-hover:opacity-100 transition-opacity">▼</button>
  </>)}
</div>
```
→ Add per-version `@` button with same hover pattern (`opacity-0 group-hover:opacity-100`), positioned top-right (same row as ▲ — stack: `@` left of `▲` OR move `▲` to `right-10`). Add DOM id `id={`logo-version-${ver.id}`}` on the container for spotlight scroll.

**6. Current allowedReferenceUrls building — `route.ts:134-165`**
```ts
const allowedReferenceUrls = new Set<string>()
for (const message of messages) {
  for (const part of message.parts ?? []) {
    if (part.type !== "file") continue
    const fileUrl = (part as { url?: string }).url
    if (typeof fileUrl === "string" && fileUrl.startsWith("https://")) allowedReferenceUrls.add(fileUrl)
  }
}
// ... then scans latest view_logo tool outputs ...
```
→ After mention validation, also: `mentionedUrls.forEach(u => allowedReferenceUrls.add(u))`.

**7. Current edit_logo tool — `route.ts:351-468` (schema + execute)**
```ts
edit_logo: tool({
  description: "Edit an existing logo image...",
  inputSchema: z.object({
    logoOrderIndex: z.number().describe("The logo number (1-based display index)"),
    versionNumber: z.number().optional().describe("Specific version number to edit from"),
    editPrompt: z.string().describe("Description of the edit to apply"),
  }),
  execute: async ({ logoOrderIndex, versionNumber, editPrompt }) => {
    const logo = await prisma.logo.findFirst({
      where: { projectId, orderIndex: logoOrderIndex - 1 },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    })
    // ...
    const sourceVersion = versionNumber
      ? logo.versions.find((v) => v.versionNumber === versionNumber)
      : logo.versions[0]
    const imgRes = await fetch(sourceVersion.imageUrl)
    const sourceBuffer = Buffer.from(await imgRes.arrayBuffer())
    result = await editLogoImage(editPrompt, sourceBuffer)
    const nextVersion = (logo.versions[0]?.versionNumber ?? 0) + 1
    const newVersion = await prisma.logoVersion.create({
      data: { logoId: logo.id, versionNumber: nextVersion, parentVersionId: sourceVersion.id, imageUrl, editPrompt, /* ... */ },
    })
  },
})
```
→ Extend input schema with `referencedVersions: z.array(z.string()).max(3).optional()` and `outputMode: z.enum(["new_version","new_logo"]).optional()`. In execute: fetch each referenced version image buffer, call `editLogoImage(prompt, sourceBuffer, sourceMime, refBuffers)`. Branch on outputMode: `new_logo` creates new Logo row with `orderIndex = max+1`, version 1, `parentVersionId = referencedVersions[0]`. Fallback: empty refs + outputMode=new_logo → treat as new_version. Target resolution when `logoOrderIndex` not provided: use Logo of first mention.

**8. Current editLogoImage — `gemini.ts:186-273`**
```ts
export async function editLogoImage(
  prompt: string,
  sourceImageBuffer: Buffer,
  sourceMimeType = "image/png"
): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  // ...
  const result = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      { inlineData: { mimeType: sourceMimeType, data: base64 } },
      prompt,
    ],
    config: { responseModalities: ["IMAGE", "TEXT"] },
  })
}
```
→ Add 4th param `extraReferences?: Array<{ data: string; mimeType: string }>`. When present, `contents = [source, ...refs, "Image 1: source to edit. Images 2..N: reference for style/content.", prompt]`. Cap total at 4 (1 source + 3 refs). Keep withRetry + withGeminiConcurrency untouched.

**9. Current onFinish persistence — `route.ts:521-545`**
The assistant side is reconstructed from `steps`. User-side `data-mention` parts are already stored earlier (lines 113-131 when user message is persisted before LLM call). **Mention parts on incoming user messages ride on `lastUserMsg.parts` and are persisted there for free.** No changes needed in onFinish.

**10. Current system prompt builder — `system-prompt.ts:82-94`**
```ts
export function buildSystemPrompt(projectContext?: {
  projectName?: string
  logoCount?: number
}) {
  let prompt = LOGO_DESIGNER_SYSTEM_PROMPT
  if (projectContext?.projectName) prompt += `\n\nCurrent project: "${projectContext.projectName}"`
  if (projectContext?.logoCount) prompt += `\nLogos generated so far: ${projectContext.logoCount}`
  return prompt
}
```
→ Extend signature: `{ projectName?, logoCount?, mentionedSection?: string }`. When `mentionedSection` non-empty, append at end of prompt. Also add one static paragraph inside `LOGO_DESIGNER_SYSTEM_PROMPT` explaining `data-mention` parts + `referencedVersions`/`outputMode` guidance (does NOT depend on mentions — always present).

**11. Data source for picker — `web/src/server/routers/logo.ts`**
- `logo.listByProject(projectId)` returns `Logo[]` with `versions` included (ordered by versionNumber asc).
- Flatten in client: `logos.flatMap(l => l.versions.map(v => ({ logoId: l.id, versionId: v.id, orderIndex: l.orderIndex, versionNumber: v.versionNumber, imageUrl: v.imageUrl, createdAt: v.createdAt })))`.
- Gallery already receives `logos` via props → reuse for picker (no extra query).

### Patterns to preserve
- **IME safety** in all input handlers (`e.nativeEvent.isComposing`).
- **Retry + concurrency** wrappers in `gemini.ts` must remain untouched — only extend `editLogoImage` signature/body.
- **allowedReferenceUrls** contract: only `https://` URLs are admitted. Mention `imageUrl` values come from `LogoVersion.imageUrl` which is a Vercel Blob `https://` URL → safe.
- **System prompt is a JS template literal (backticks)** — do NOT use backticks inside the string.
- **Zero DB migration** — `data-mention` parts live in existing `ChatMessage.parts` JSON.

### Backwards compatibility contract
- Legacy `"#3 v2"` free-text references stay working: the `edit_logo` tool's `logoOrderIndex` path is unchanged when `referencedVersions` is absent.
- `edit_logo` callers that omit new fields → identical behaviour to today.
- Old `ChatMessage` rows (no `data-mention` parts) → renderer no-ops on absence.

---

## Testing Plan (TDD — tests first)

### Unit — Zod / pure logic
- [x] T1. Create `web/src/lib/chat/mention-types.test.ts`: `LogoMentionPartSchema` round-trip (parse + serialize); rejects missing `versionId`; rejects extra unknown field when using `.strict()`; accepts valid `{ type: "data-mention", data: { logoId, versionId, orderIndex, versionNumber, imageUrl } }`.
- [x] T2. Create `web/src/lib/chat/composer-store.test.ts`: `addMention` dedupes by `versionId`; caps at 3 (4th returns `false` or no-ops); `removeMention` targets correct projectId bucket; `clear(projectId)` empties only that project; two projectIds isolated.
- [x] T3. Create `web/src/lib/chat/system-prompt.test.ts`: `buildSystemPrompt()` with no `mentionedSection` → prompt does NOT contain the `## User-mentioned logo versions` header; with `mentionedSection` of 3 entries → header present + each entry line present; static mention-guidance paragraph is ALWAYS present (base prompt).

### Unit — Server handlers
- [x] T4. Create `web/src/app/api/chat/mention-pipeline.test.ts` (extract pure helpers from route.ts into a small module e.g. `web/src/app/api/chat/mentions.ts` so they're testable): `extractMentionParts(userMessage)` returns only `type: "data-mention"` entries; `validateMentions(mentions, projectId, prisma)` → mocked prisma returns 2 versions for 2 ids → ok; returns fewer ids → throws validation error with `missingVersionIds`; cross-project version → error.
- [x] T5. Create `web/src/app/api/chat/edit-logo-handler.test.ts` (extract edit_logo execute body into a testable helper `runEditLogo(input, ctx)` that takes `{ projectId, prisma, editLogoImage, fetchImageBuffer }`): 
  - `outputMode: "new_version"` + legacy `logoOrderIndex` path → new version appended, `parentVersionId` = sourceVersion.id.
  - `outputMode: "new_version"` + no `logoOrderIndex` + `referencedVersions: [v]` → resolves target Logo from first ref's logoId.
  - `outputMode: "new_logo"` + 2 refs → creates new Logo (next orderIndex), version 1, `parentVersionId = refs[0]`.
  - `outputMode: "new_logo"` + empty refs → falls back to `new_version`.
  - `editLogoImage` mock receives `refBuffers.length === referencedVersions.length`
- [x] T6. Extend `web/src/app/api/chat/route.test.ts` (exists): a new block `describe("mention validation")` — POST with `data-mention` for non-existent versionId → 400 JSON `{ error: "mention_invalid", missingVersionIds: [id] }` and LLM mock is not called; cross-project mention → same; valid mention → `messages` passed to LLM contain 2 extra `file` parts matching mention URLs and system prompt contains the `## User-mentioned logo versions` header.

### Unit — gemini.ts
- [x] T7. Extend `web/src/lib/gemini.test.ts`: `editLogoImage(prompt, src, "image/png", [ref1, ref2])` → mock `ai.models.generateContent` and assert `contents` array shape = `[srcInlineData, ref1InlineData, ref2InlineData, instructionText, prompt]`; when `extraReferences` undefined or empty, instruction line is NOT present and shape matches today's `[srcInlineData, prompt]`.

### Component tests (vitest + @testing-library/react)
- [x] T8. Create `web/src/components/chat/logo-mention-picker.test.tsx`: given `versions: LogoMentionData[]` of length 3 and `query="2"` → picker filters to `orderIndex === 1` (display #2); `query="2v1"` → only `versionNumber=1` of logo #2; empty versions → shows "아직 로고가 없습니다 — 먼저 로고를 생성해주세요." copy; `onSelect` fires with selected mention.
- [x] T9. Create `web/src/components/chat/mention-chip.test.tsx`: renders `#N vM`; clicking `×` fires `onRemove`; `disabled` variant shows "삭제됨" and does NOT fire onClick.
- [x] T10. Create `web/src/components/chat-panel.mention.test.tsx`: 
  - Typing `@` (no IME) opens the picker; typing `@` while `onCompositionStart` active → picker does NOT open.
  - Selecting an item from the picker: `@token` removed from textarea value; `composerStore.addMention` called.
  - Backspace at caret 0 with 2 chips → last chip removed (composerStore.removeMention called with last versionId).
  - Attempting to add 4th chip (store already has 3) → sonner toast called with `"최대 3개까지 멘션할 수 있어요"`; store stays at 3.
### Component tests — gallery
- [x] T11. Create `web/src/components/gallery-panel.mention.test.tsx`:
  - Hovering a version card reveals the "@ 인용" button (opacity class assertion on hover is tricky; instead render with forced `data-testid` and assert click path).
  - Clicking the `@` button calls `composerStore.addMention({ logoId, versionId, orderIndex, versionNumber, imageUrl })`.
  - When `composerStore.composerProjectId !== currentProjectId`, the button is rendered with `disabled` attribute + `title` tooltip.

### Component tests — history chip render + click
- [x] T12. Extend or create `web/src/components/chat-panel.history-mention.test.tsx`: a user message with `parts: [mention, mention, text]` renders two chip components ABOVE the text block (assert DOM order); clicking a chip calls `gallerySpotlightStore.spotlight(versionId)`; a chip whose versionId is not in current `logos` data is rendered as `disabled` with "삭제됨".

### E2E (Playwright)
- [x] T13. Create `web/tests/e2e/mention-flow.spec.ts` (or whatever Playwright root is — confirm in `playwright.config.ts`): happy path — log in, open project with 2 generated logos, open composer, type `@`, pick `#1 v1`, type `@` again, pick `#2 v1`, send `"두 로고 합쳐줘"`, wait for assistant turn → assert a new logo row (3rd) appears in gallery and the tool call in DevTools console shows `outputMode: "new_logo"` with 2 versionIds. Skip test if `E2E_GOOGLE_TEST_USER` env not set.

---

## Implementation Plan

### 1. Dependencies & shared primitives
- [x] I1. `cd web && pnpm add cmdk zustand sonner` — update `web/package.json` deps.
- [x] I2. Create `web/src/lib/chat/mention-types.ts`:
  - Export `LogoMentionData` TS type (`logoId: string; versionId: string; orderIndex: number; versionNumber: number; imageUrl: string`).
  - Export `LogoMentionPart` type (`{ type: "data-mention"; data: LogoMentionData }`).
  - Export Zod schemas `LogoMentionDataSchema`, `LogoMentionPartSchema`.
  - Export helper `isMentionPart(part: unknown): part is LogoMentionPart`.
- [x] I3. Create `web/src/lib/chat/composer-store.ts` (Zustand):
  - Shape: `{ mentionsByProject: Record<string, LogoMentionData[]>; activeProjectId: string | null; addMention(projectId, m): boolean; removeMention(projectId, versionId): void; clear(projectId): void; setActiveProject(id): void; }`.
  - `addMention` dedupes by `versionId`, caps at 3 (returns `false` and fires `sonner.toast` when full).
  - Persist behaviour: none (in-memory only; survives SPA navigations within same tab, clears on reload).
- [x] I4. Create `web/src/lib/chat/gallery-spotlight-store.ts` (Zustand):
  - `{ spotlightVersionId: string | null; spotlight(versionId): void; clear(): void; }`.
  - On `spotlight`, set id; consumers run a `useEffect` to `scrollIntoView` + add a temporary CSS class for ~1s then clear.
- [x] I5. Mount `<Toaster />` from `sonner` in `web/src/app/providers.tsx` (at the bottom of the provider tree). Set `position="top-center"` to match typical UX.

### 2. Shared server helpers (for testability)
- [x] I6. Create `web/src/app/api/chat/mentions.ts`:
  - `extractMentionParts(userMessage): LogoMentionPart[]`
  - `validateMentions(mentions, projectId, prisma): Promise<LogoVersionWithLogo[]>` — throws `MentionValidationError` with `missingVersionIds` when count mismatch OR cross-project version detected.
  - `renderMentionedVersionsForPrompt(versions): string` — produces the markdown block that goes into system prompt; truncates `logo.prompt` to 200 chars per entry; returns `""` when `versions.length === 0`.
  - `fetchImageBufferFromUrl(url): Promise<{ buffer: Buffer; mimeType: string }>` — reusable helper for edit_logo ref loading AND for any future use.

### 3. Gemini: multi-reference edit
- [x] I7. In `web/src/lib/gemini.ts`: extend `editLogoImage(prompt, sourceImageBuffer, sourceMimeType = "image/png", extraReferences?: Array<{ data: string; mimeType: string }>)`:
  - Cap total inputs: if `extraReferences.length > 3`, slice to first 3.
  - Build contents array: `[ {inlineData: source}, ...refs.map(r => ({inlineData: r})), ...(refs.length ? ["Image 1: source to edit. Images 2..N: reference for style/content."] : []), prompt ]`.
  - Keep `withRetry` + `withGeminiConcurrency` wrappers unchanged.
  - Update JSDoc.

### 4. System prompt: mention guidance + dynamic section
- [x] I8. In `web/src/lib/chat/system-prompt.ts`:
  - Add a new static paragraph near the Vision section inside `LOGO_DESIGNER_SYSTEM_PROMPT`: explain that users may attach `data-mention` parts → treat as ground truth subject → pass `versionId`s through `edit_logo.referencedVersions` → choose `outputMode`.
  - Extend `buildSystemPrompt({ projectName?, logoCount?, mentionedSection? })`:
    - When `mentionedSection` is a non-empty string, append `\n\n${mentionedSection}` at end.

### 5. /api/chat route: mention pipeline + tool schema
- [x] I9. In `web/src/app/api/chat/route.ts`:
  - Import helpers from `mentions.ts`.
  - After the existing `lastUserMsg` file-upload handling block (around line 110) and BEFORE persistence:
    1. `const mentions = extractMentionParts(lastUserMsg)`.
    2. If `mentions.length > 0`, `const versions = await validateMentions(mentions, projectId, prisma)` — on `MentionValidationError`, return `Response.json({ error: "mention_invalid", missingVersionIds }, { status: 400 })` **before** persisting anything.
    3. Append `{ type: "file", mediaType: "image/png", url: v.imageUrl }` parts to `lastUserMsg.parts` for each validated version (so AI SDK `convertToModelMessages` turns them into image parts for the LLM). (NOTE: this in-place push means persisted user message also stores the resolved file parts — acceptable per design.)
    4. `versions.forEach(v => allowedReferenceUrls.add(v.imageUrl))`.
    5. Build `mentionedSection = renderMentionedVersionsForPrompt(versions)` and pass to `buildSystemPrompt({ projectName, logoCount, mentionedSection })`.
- [x] I10. Extend `edit_logo` tool definition:
  - Input schema: add `referencedVersions: z.array(z.string()).max(3).optional()`, `outputMode: z.enum(["new_version","new_logo"]).optional()`.
  - Update description so LLM knows about the new fields.
  - Execute body:
    - If `referencedVersions?.length`, fetch each via `fetchImageBufferFromUrl(v.imageUrl)` → build `refBuffers: Array<{ data: base64, mimeType }>`.
    - Resolve "target Logo" for `new_version`:
      - If `logoOrderIndex` provided → existing path (projectId + orderIndex-1).
      - Else if first referenced version exists → `prisma.logoVersion.findUnique({ include: { logo: true } })` → use that Logo.
      - Else return error payload (shouldn't happen because schema requires `logoOrderIndex` today; keep required for backwards compat, mentions augment but don't replace).
    - Call `editLogoImage(editPrompt, sourceBuffer, sourceMimeType, refBuffers)`.
    - Branch `outputMode`:
      - `"new_logo"` + `referencedVersions.length > 0`: compute `orderIndex = (max by projectId) + 1`; `prisma.logo.create({ data: { projectId, orderIndex, prompt: editPrompt, aspectRatio: sourceLogo.aspectRatio } })` → `prisma.logoVersion.create({ versionNumber: 1, parentVersionId: referencedVersions[0], imageUrl, s3Key, editPrompt, logoId: newLogo.id })`.
      - `"new_logo"` + empty refs: treat as `"new_version"` (fallback).
      - default / `"new_version"`: existing append-version path (no change).

### 6. Chat hooks + composer submit wiring
- [x] I11. In `web/src/lib/chat/hooks.ts`: extend `sendMessage(content: string, fileParts?, mentionParts?: LogoMentionPart[])`:
  - When `mentionParts?.length`, build `parts = [{ type: "text", text: content }, ...(fileParts ?? []), ...mentionParts]` and call `chat.sendMessage({ role: "user", parts })`.
  - Preserve existing simple paths for text-only / file-only cases.
- [x] I12. In `web/src/components/chat-panel.tsx` `submitMessage`:
  - `const mentions = composerStore.getState().mentionsByProject[projectId] ?? []`.
  - `const mentionParts: LogoMentionPart[] = mentions.map(data => ({ type: "data-mention" as const, data }))`.
  - Call `chat.sendMessage(content, fileParts, mentionParts)`.
  - Call `composerStore.getState().clear(projectId)` after.
  - Call `composerStore.getState().setActiveProject(projectId)` in a `useEffect([projectId])`.

### 7. Composer UI: chips row + `@` picker
- [x] I13. Create `web/src/components/chat/mention-chip.tsx`:
  - Props: `{ data: LogoMentionData; onRemove?(): void; disabled?: boolean; onClick?(): void }`.
  - Renders: avatar thumbnail (24px round, `object-contain bg-white`), text `#${orderIndex+1} v${versionNumber}`, `×` button when `onRemove`; when `disabled`, greys out + appends "삭제됨" label.
- [x] I14. Create `web/src/components/chat/logo-mention-picker.tsx` using `cmdk`:
  - Props: `{ versions: LogoMentionData[]; open: boolean; query: string; onQueryChange(q): void; onSelect(m): void; onClose(): void; anchorRect?: DOMRect }`.
  - Use `cmdk` `<Command>` with controlled `value`/`onValueChange` for keyboard nav.
  - Numeric filter: if `/^@?(\d+)(?:v(\d+))?/.exec(query)` matches → filter to `orderIndex+1 === N && (M ? versionNumber === M : true)`; else fuzzy match on logo prompt summary.
  - Empty gallery → "아직 로고가 없습니다 — 먼저 로고를 생성해주세요." state.
  - Position: floating popup anchored to textarea caret via the existing trick (mirror-span measurement). First-pass: anchor to textarea bottom-left. Second-pass (if time): mirror-span.
- [x] I15. In `web/src/components/chat-panel.tsx`:
  - Above the textarea container (before the `<textarea>`), render chips row from `composerStore`:
    ```tsx
    {mentions.length > 0 && (
      <div className="flex flex-wrap gap-1 px-3 pt-2">
        {mentions.map(m => <MentionChip key={m.versionId} data={m} onRemove={() => composerStore.getState().removeMention(projectId, m.versionId)} />)}
      </div>
    )}
    ```
  - In `onChange`: detect `@` trigger → match `/(^|\s)@([^\s]*)$/` against `value.slice(0, selectionStart)`. If match and not composing, open picker with `query = match[2]`.
  - On picker `onSelect`:
    - `composerStore.addMention(projectId, selected)` → if returns false (cap hit), toast; else continue.
    - Replace the `@<query>` slice in textarea value with empty string; close picker.
  - Extend `onKeyDown`: Backspace at `selectionStart===0 && selectionEnd===0 && chips.length>0 && !isComposing` → prevent default, `removeMention(projectId, last.versionId)`.
  - Source `versions` for picker from the existing `logos` prop (gallery already passes logos in; if not, add a tRPC `logo.listByProject` useQuery here).

### 8. Gallery: per-version "@ 인용" button + DOM id
- [x] I16. In `web/src/components/gallery-panel.tsx` version card JSX (~line 156–210):
  - Add `id={`logo-version-${ver.id}`}` on the image container `<div>`.
  - Add a new `<button>` inside, positioned `absolute top-1.5 right-10` (to the left of the existing ▲ nav button), with same `opacity-0 group-hover:opacity-100 transition-opacity` classes. Icon: `@` glyph or `lucide-react` `AtSign` (but lucide is not installed → just use `@` text with a rounded background, matching ▲/▼ styling).
  - onClick: `e.stopPropagation(); composerStore.addMention(projectId, { logoId: logo.id, versionId: ver.id, orderIndex: logo.orderIndex, versionNumber: ver.versionNumber, imageUrl: ver.imageUrl })` → if result false, `sonner.toast("최대 3개까지 멘션할 수 있어요")`.
  - Disabled when `composerStore.activeProjectId && composerStore.activeProjectId !== projectId`; render with `disabled` attr + `title="현재 열린 채팅 프로젝트와 달라 인용할 수 없어요"`.

### 9. History chip rendering + click-to-highlight
- [x] I17. In `web/src/components/chat-panel.tsx` `buildSegments`:
  - Extend `Segment` union with `{ kind: "mention"; data: LogoMentionData; index: number }`.
  - Add branch `if (part.type === "data-mention") { flushText(); segments.push({ kind: "mention", data: (part as any).data, index }) }`.
- [x] I18. Extend the segment renderer (around lines 331–340):
  - For `seg.kind === "mention"`: render `<MentionChip data={seg.data} onClick={() => gallerySpotlightStore.getState().spotlight(seg.data.versionId)} disabled={!logos.some(l => l.versions.some(v => v.id === seg.data.versionId))} />`.
  - Group adjacent mentions into a single flex row wrapper above text if desired (nice-to-have).
- [x] I19. In `gallery-panel.tsx`: subscribe to `gallerySpotlightStore.spotlightVersionId` with `useEffect`. When set, `document.getElementById(`logo-version-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })`, add a CSS class `ring-2 ring-[#ffb74d]` for ~1200ms then remove; then clear store.

### 10. Manual verification & docs
- [x] I20. Run `pnpm --filter web typecheck` / `pnpm build` in `web/` → fix any type errors.
- [x] I21. Run `pnpm --filter web test` (vitest) → all green.
- [x] I22. Run `pnpm --filter web exec playwright test tests/e2e/mention-flow.spec.ts` locally → green (or skip-when-env-missing).
- [x] I23. Manual smoke: empty gallery `@` shows empty-state copy; gallery "@ 인용" inserts chip; Backspace removes last chip; `×` on chip removes it; 4th mention attempt toasts; legacy `#3 v2` text-only message still triggers `edit_logo` normally; history chip click spotlights gallery card; deleted version renders "삭제됨" chip in history.
- [x] I24. Append a "Logo mentions" subsection under "Architecture Decisions" in root `AGENTS.md` (3–5 bullets summarising: `data-mention` part shape, cap at 3, composer store, gallery `@ 인용`, `referencedVersions`/`outputMode` on `edit_logo`).

---

## Parallelization Plan

### Batch 0 (sequential prerequisite — 1 coder)
- [x] **Coder P0: deps + shared types + helpers**  
  Files: `web/package.json`, `web/pnpm-lock.yaml`, `web/src/lib/chat/mention-types.ts` (new), `web/src/lib/chat/composer-store.ts` (new), `web/src/lib/chat/gallery-spotlight-store.ts` (new), `web/src/app/api/chat/mentions.ts` (new), `web/src/app/providers.tsx` (mount `<Toaster />`).  
  Tasks: I1, I2, I3, I4, I5, I6. **Also writes T1, T2.**  
  Must complete before all later batches because every other batch depends on these modules existing.

### Batch 1 (parallel — 4 coders, independent file sets)
- [x] **Coder A: gemini multi-reference**  
  Files: `web/src/lib/gemini.ts`, `web/src/lib/gemini.test.ts` (extend).  
  Tasks: I7, T7.
- [x] **Coder B: system prompt**  
  Files: `web/src/lib/chat/system-prompt.ts`, `web/src/lib/chat/system-prompt.test.ts` (new).  
  Tasks: I8, T3.
- [x] **Coder C: chat route mention pipeline + edit_logo tool schema**  
  Files: `web/src/app/api/chat/route.ts`, `web/src/app/api/chat/route.test.ts` (extend), `web/src/app/api/chat/mention-pipeline.test.ts` (new), `web/src/app/api/chat/edit-logo-handler.test.ts` (new). Plus extract edit_logo execute body into a small helper if needed for testability — allowed to edit `web/src/app/api/chat/mentions.ts` ONLY to add `runEditLogo` helper (must coordinate with P0 output or create new file `web/src/app/api/chat/edit-logo.ts` instead — **preferred: new file to avoid collision**).  
  Tasks: I9, I10, T4, T5, T6.
- [x] **Coder D: chat hook signature**  
  Files: `web/src/lib/chat/hooks.ts`.  
  Tasks: I11 (no new tests — covered by component tests in Batch 2).

### Batch 2 (parallel — 3 coders, after Batch 1)
- [x] **Coder E: composer UI (chips row + picker + Backspace + toast)**  
  Files: `web/src/components/chat/mention-chip.tsx` (new), `web/src/components/chat/logo-mention-picker.tsx` (new), `web/src/components/chat/mention-chip.test.tsx` (new), `web/src/components/chat/logo-mention-picker.test.tsx` (new), `web/src/components/chat-panel.tsx` (composer region only — chips row render + onChange/onKeyDown extension + submitMessage wiring), `web/src/components/chat-panel.mention.test.tsx` (new).  
  Tasks: I12, I13, I14, I15, T8, T9, T10.
- [x] **Coder F: gallery "@ 인용" button + spotlight hookup**  
  Files: `web/src/components/gallery-panel.tsx`, `web/src/components/gallery-panel.mention.test.tsx` (new).  
  Tasks: I16, I19, T11.
- [x] **Coder G: history mention rendering**  
  Files: `web/src/components/chat-panel.tsx` (rendering region only — `buildSegments` + segment renderer), `web/src/components/chat-panel.history-mention.test.tsx` (new).  
  Tasks: I17, I18, T12.

### Batch 3 (sequential — 1 coder, after Batch 2)
- [x] **Coder H: E2E + verification + docs**  
  Files: `web/tests/e2e/mention-flow.spec.ts` (new; confirm dir against `web/playwright.config.ts`), `AGENTS.md` (root).  
  Tasks: I20, I21, I22, I23, I24, T13.

### File-scope conflict resolution (critical — no shared files across parallel coders)
- `web/src/components/chat-panel.tsx` is touched by Coder E (composer region) AND Coder G (history rendering region). To avoid merge conflicts, **Coder E completes first**, then **Coder G** edits in a second sub-batch:
  - **Revised Batch 2**:
    - **Sub-batch 2a (parallel)**: Coder E, Coder F.
    - **Sub-batch 2b (after 2a)**: Coder G (depends on E's edits to `chat-panel.tsx`).

### Dependencies
- Batch 0 blocks everything (shared types/stores/helpers).
- Batch 1 blocks Batch 2 because composer UI imports `composer-store` (from Batch 0) AND the `sendMessage` signature is extended in Batch 1 (Coder D).
- Batch 2b blocks Batch 3 because E2E and docs need the whole feature wired.

### Risk Areas
- `web/src/components/chat-panel.tsx` is edited by both Coder E (Sub-batch 2a) and Coder G (Sub-batch 2b) — enforced sequential.
- `cmdk` portal vs textarea focus loss: if picker steals focus on open, auto-refocus textarea after selection (explicitly call `inputRef.current?.focus()`).
- `allowedReferenceUrls` already uses a `Set<string>` — adding mention URLs must happen BEFORE tool definitions are closed over the Set (check closure timing in route.ts — Set is mutable so ordering holds as long as we add before `streamText()` call).
- Mention image URL might be `image/webp` (from Vercel Blob resize) not `image/png` — design says default to `image/png` for the file-part we inject but the AI SDK generally accepts both; however for correctness, **do a HEAD request or derive from URL extension when adding the file part**, or just send `mediaType: "image/png"` — spec says `image/png` with a fallback hint. Keep it simple: hard-code `"image/png"` as spec does; model tolerates mis-declared image types in practice.
- Existing `web/src/app/api/chat/route.test.ts` may depend on current `buildSystemPrompt` signature — verify the signature extension is backwards compat (it is: new field is optional).
- `composer-store` MUST be reset when the user switches projects — implement by calling `setActiveProject(projectId)` in a `useEffect([projectId])` inside `chat-panel.tsx`, and clearing stale project buckets in `clear()` can stay per-project (spec asks only same-project behaviour).

---

## Done Criteria

- [x] All 13 test tasks (T1–T13) authored and green (vitest unit/component + Playwright E2E).
- [x] `pnpm --filter web typecheck` (or `pnpm build` in `web/`) passes with zero TypeScript errors.
- [x] `pnpm --filter web test` passes (existing tests + all new tests).
- [x] Legacy `"#3 v2"` free-text path still works end-to-end (manual smoke).
- [x] OpenSpec tasks checked in `openspec/changes/chat-logo-mention/tasks.md`:
  - 1.1, 1.2, 1.3 (deps + store + types)
  - 2.1, 2.2, 2.3 (composer UI)
  - 3.1, 3.2 (submit wiring)
  - 4.1, 4.2 (gallery entry point)
  - 5.1, 5.2, 5.3 (history chips)
  - 6.1–6.5 (chat route pipeline)
  - 7.1, 7.2 (system prompt)
  - 8.1–8.6 (edit_logo tool)
  - 9.1–9.3 (gemini multi-ref)
  - 10.1–10.7 (tests)
  - 11.1–11.5 (verification)
- [x] OpenSpec `ai-chat-engine` + `gallery-ui` spec deltas covered by implemented behaviour (validation 400 payload shape, cap-at-3 toast, disabled cross-project gallery button, history chip "삭제됨" state, `referencedVersions` + `outputMode` on `edit_logo`).
- [x] `AGENTS.md` updated with a "Logo mentions" architecture-decision subsection.
- [x] No DB migration introduced; `ChatMessage.parts` JSON is the only persistence surface for `data-mention`.
