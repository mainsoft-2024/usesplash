---
created: 2026-04-14T00:00:00Z
last_updated: 2026-04-14T00:00:00Z
type: nonspec
change_id: chat-image-attachment
status: pending
trigger: "Add image attachment support to chat panel — users can attach images to messages, which get sent as file parts to the AI model via AI SDK v6"
---

# Plan: Chat Image Attachment Support

## Background & Research

### Research Doc
`.slash/workspace/research/ai-sdk-v6-image-attachments.md` — full API reference for AI SDK v6 parts-based image attachments.

### AI SDK v6 Image Parts API

Client sends images as file parts in the `parts` array:

```tsx
sendMessage({
  role: 'user',
  parts: [
    { type: 'text', text: 'Describe this image' },
    { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,...' },
  ],
});
```

`convertToModelMessages()` on the server automatically converts `file` parts to provider-compatible format (e.g., `image_url` for OpenRouter/Gemini). No server-side changes needed for model consumption.

### Current hooks.ts (full file — 62 lines)

File: `web/src/lib/chat/hooks.ts`
```typescript
"use client"

import { useChat as useAIChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export function useProjectChat(projectId: string, initialMessages?: UIMessage[]) {
  const [input, setInput] = useState("")
  const prevLengthRef = useRef(0)

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { projectId } }),
    [projectId]
  )

  const chat = useAIChat({
    id: projectId,
    transport,
    messages: initialMessages,
  })

  useEffect(() => {
    const nextLength = initialMessages?.length ?? 0
    const prevLength = prevLengthRef.current

    if (prevLength === 0 && nextLength > 0 && initialMessages) {
      chat.setMessages(initialMessages)
    }

    prevLengthRef.current = nextLength
  }, [initialMessages])

  const sendMessage = useCallback(
    (content: string) => {
      chat.sendMessage({ text: content })
    },
    [chat]
  )

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const content = input.trim()
      if (!content) return
      chat.sendMessage({ text: content })
      setInput("")
    },
    [chat, input]
  )

  return {
    messages: chat.messages,
    input,
    setInput,
    handleSubmit,
    sendMessage,
    isLoading: chat.status === "submitted" || chat.status === "streaming",
    error: chat.error,
    reload: chat.regenerate,
    stop: chat.stop,
  }
}
```

**Key change needed**: `sendMessage` and `handleSubmit` both call `chat.sendMessage({ text })` — need to accept an optional `files` parameter and include file parts in the `parts` array.

### Current chat-panel.tsx — Input Area (lines 248–297)

File: `web/src/components/chat-panel.tsx` lines 248–297
```tsx
      <form onSubmit={chat.handleSubmit} className="shrink-0 border-t border-[var(--divider)] bg-[var(--bg-primary)] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className={`${THREAD}`}>
          <div className={`flex items-end gap-2 rounded-2xl border ${isFocused ? "border-[var(--accent-green)]/50" : "border-[var(--border-secondary)]"} bg-[var(--bg-secondary)] px-1 transition-colors`}>
            <div className="flex min-h-[44px] flex-1 items-end">
              <textarea
                ref={inputRef}
                value={chat.input}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={(e) => {
                  chat.setInput(e.target.value)
                  e.target.style.height = "auto"
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || ("isComposing" in e && e.isComposing)) return
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    if (chat.input.trim() && !chat.isLoading) {
                      chat.handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
                    }
                  }
                }}
                placeholder="메시지를 입력하세요…"
                rows={1}
                className="max-h-[160px] min-h-[44px] w-full flex-1 resize-none bg-transparent px-3 py-2.5 text-[0.9375rem] leading-snug text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none"
              />
            </div>
            {chat.isLoading ? (
              <button type="button" onClick={chat.stop} className="mb-0.5 h-9 shrink-0 rounded-xl bg-[var(--accent-red)] px-3.5 text-sm font-semibold text-white transition-colors hover:brightness-110">
                정지
              </button>
            ) : (
              <button type="submit" disabled={!chat.input.trim()} className="mb-0.5 h-9 shrink-0 rounded-xl bg-[var(--accent-green)] px-4 text-sm font-semibold text-black transition-colors hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50">
                전송
              </button>
            )}
          </div>

          {isFocused && (
            <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">Shift+Enter 줄바꿈 · 마크다운</p>
          )}
        </div>
      </form>
```

### Current chat-panel.tsx — Message Rendering / buildSegments (lines 35–59)

File: `web/src/components/chat-panel.tsx` lines 35–59
```tsx
function buildSegments(parts: UIMessage["parts"]): Segment[] {
  if (!parts?.length) return []

  const segments: Segment[] = []
  let textBuf = ""

  const flushText = () => {
    if (textBuf.length > 0) {
      segments.push({ kind: "text", content: textBuf })
      textBuf = ""
    }
  }

  parts.forEach((part, index) => {
    if (part.type === "text") {
      textBuf += part.text
      return
    }
    flushText()
    segments.push({ kind: "tool", part, index })
  })

  flushText()
  return segments
}
```

**Key change needed**: `buildSegments` ignores `file` parts — they fall through to the tool branch. Need to handle `file` parts as a new segment kind `"image"`.

### Current chat-panel.tsx — Segment type (lines 13–33)

File: `web/src/components/chat-panel.tsx` lines 13–33
```tsx
const THREAD = "mx-auto w-full max-w-2xl px-4 sm:px-6"

type Segment =
  | { kind: "text"; content: string }
  | { kind: "tool"; part: UIMessage["parts"][number]; index: number }
```

### Current route.ts — User Message Persistence (lines 50–68)

File: `web/src/app/api/chat/route.ts` lines 50–68
```typescript
  // Save user message to DB
  const lastUserMsg = messages[messages.length - 1]
  if (lastUserMsg?.role === "user") {
    const userText = lastUserMsg.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim()

    if (userText) {
      await prisma.chatMessage.create({
        data: {
          projectId,
          role: "user",
          content: userText,
        },
      })
    }
  }
```

**Key change needed**: Currently only saves text content for user messages. Needs to also save `parts` (including file parts) so images persist and display on reload.

### Current route.ts — Message conversion (line 73)

```typescript
    messages: await convertToModelMessages(messages, { ignoreIncompleteToolCalls: true }),
```

No change needed — `convertToModelMessages()` automatically handles `file` parts.

### Constraints
- Max file size: 4MB per image (Gemini limit)
- Accept: image/png, image/jpeg, image/webp
- Data URLs for inline transport (no separate upload step)
- Korean UI labels
- No new dependencies
- Korean IME `isComposing` check must remain intact

---

## Testing Plan (TDD — tests first)

No existing test infrastructure in this project (no test runner configured). Skip automated tests — verification will be via build check + manual.

- [ ] Verify TypeScript build passes after all changes (`npm run build` in `web/`)

---

## Implementation Plan

### Task 1: Update Segment type and buildSegments to handle file/image parts
**File**: `web/src/components/chat-panel.tsx` (lines 15–59)
- [ ] Add `"image"` variant to `Segment` type: `| { kind: "image"; url: string; mediaType: string; filename?: string }`
- [ ] In `buildSegments`, add a branch for `part.type === "file"` before the tool fallthrough: flush text buffer, push `{ kind: "image", url: part.url || \`data:${part.mediaType};base64,${part.data}\`, mediaType: part.mediaType, filename: part.filename }` segment

### Task 2: Add image segment rendering in message list
**File**: `web/src/components/chat-panel.tsx` (lines 213–218)
- [ ] In the segments.map renderer, add a branch for `seg.kind === "image"`: render `<img src={seg.url} alt={seg.filename || "첨부 이미지"} className="mt-2 max-h-64 max-w-xs rounded-lg border border-[var(--border-primary)]" />`

### Task 3: Add file attachment state and helpers to chat-panel.tsx
**File**: `web/src/components/chat-panel.tsx` (lines 62–68 area)
- [ ] Add state: `const [attachedFiles, setAttachedFiles] = useState<File[]>([])`
- [ ] Add ref: `const fileInputRef = useRef<HTMLInputElement>(null)`
- [ ] Add helper function `convertFilesToDataURLParts(files: File[])` that returns `Promise<Array<{ type: 'file'; mediaType: string; url: string }>>` using `FileReader.readAsDataURL()`
- [ ] Add helper function `removeFile(index: number)` to remove a file from `attachedFiles`
- [ ] Add constant: `const MAX_FILE_SIZE = 4 * 1024 * 1024` (4MB)
- [ ] Add constant: `const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]`

### Task 4: Update hooks.ts to support file parts in sendMessage and handleSubmit
**File**: `web/src/lib/chat/hooks.ts`
- [ ] Change `sendMessage` signature: `(content: string, fileParts?: Array<{ type: 'file'; mediaType: string; url: string }>) => void`
- [ ] In `sendMessage` body: if `fileParts?.length`, call `chat.sendMessage({ role: 'user', parts: [{ type: 'text', text: content }, ...fileParts] })` else keep current `chat.sendMessage({ text: content })`
- [ ] Change `handleSubmit` signature: `(event: React.FormEvent<HTMLFormElement>, fileParts?: Array<{ type: 'file'; mediaType: string; url: string }>) => void`
- [ ] In `handleSubmit` body: same pattern — if `fileParts?.length`, use parts-based sendMessage, else keep current
- [ ] Update return type: also expose the raw `chat.sendMessage` as `sendRawMessage` for direct parts-based sends (or just let `sendMessage` handle it)

### Task 5: Add attachment UI to the input area
**File**: `web/src/components/chat-panel.tsx` (lines 248–297)
- [ ] Add hidden `<input type="file" ref={fileInputRef} accept="image/png,image/jpeg,image/webp" multiple onChange={handleFileSelect} className="hidden" />` before the form
- [ ] Add `handleFileSelect` function: validate each file (type check, size check ≤4MB), append valid files to `attachedFiles`, show alert for invalid ones
- [ ] Add attachment button (📎 icon or SVG) to the left of the textarea, inside the rounded input container. `onClick` → `fileInputRef.current?.click()`. Style: `h-9 w-9 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors`
- [ ] Add preview strip above the textarea (inside the input container, before the textarea row): if `attachedFiles.length > 0`, render a horizontal flex row of thumbnail previews. Each thumbnail: 48×48px, rounded, object-cover, with an X button overlay to remove. Use `URL.createObjectURL(file)` for preview src. Clean up object URLs on unmount/removal.
- [ ] Update submit button disabled condition: `disabled={!chat.input.trim() && attachedFiles.length === 0}` (allow sending image-only messages)

### Task 6: Wire up form submission with file parts
**File**: `web/src/components/chat-panel.tsx`
- [ ] Override form `onSubmit`: instead of `chat.handleSubmit`, create a custom handler that: (1) calls `convertFilesToDataURLParts(attachedFiles)`, (2) calls `chat.sendMessage(input, fileParts)` or `chat.handleSubmit(e, fileParts)`, (3) clears `attachedFiles` and resets `fileInputRef`
- [ ] Update the Enter key handler in `onKeyDown` to also include file parts (same flow as form submit)
- [ ] Ensure suggestion chips still work (they call `chat.sendMessage(chip)` with no files — no change needed)

### Task 7: Update route.ts to persist user image parts
**File**: `web/src/app/api/chat/route.ts` (lines 50–68)
- [ ] When saving user message, check if `lastUserMsg.parts` contains any `file` parts
- [ ] If file parts exist, save the full `parts` array to `ChatMessage.parts` field (in addition to `content` for text)
- [ ] Change the create call to: `await prisma.chatMessage.create({ data: { projectId, role: "user", content: userText, parts: lastUserMsg.parts.some(p => p.type === 'file') ? lastUserMsg.parts : undefined } })`
- [ ] Note: data URLs in parts may be large — this is acceptable for now since images are ≤4MB and stored as JSON in the parts field

### Task 8: Handle persisted image parts on page reload
**File**: `web/src/app/projects/[id]/page.tsx` (or `web/src/lib/chat/parse-messages.ts`)
- [ ] Verify that `parseInitialMessages` correctly reconstructs user messages with `file` parts from the `ChatMessage.parts` JSON field
- [ ] If `parts` is stored, it should already be loaded as-is into UIMessage format. Check that user messages with `parts` field set use `parts` directly instead of wrapping `content` in a text part.
- [ ] Test: messages with images should show thumbnails after page reload

### Task 9: Build verification
- [ ] Run `npm run build` in `web/` — must pass with zero TypeScript errors

---

## Parallelization Plan

### Batch 1 (parallel)
- [ ] **Coder A**: Tasks 1, 2, 3, 5, 6 → files: `web/src/components/chat-panel.tsx`
  - Update Segment type + buildSegments for image parts
  - Add image rendering in message list
  - Add file attachment state, helpers, UI, preview strip
  - Wire up form submission with files
- [ ] **Coder B**: Task 4 → files: `web/src/lib/chat/hooks.ts`
  - Update sendMessage and handleSubmit to accept file parts

### Batch 2 (after Batch 1)
- [ ] **Coder C**: Tasks 7, 8 → files: `web/src/app/api/chat/route.ts`, `web/src/lib/chat/parse-messages.ts`
  - Update user message persistence to save file parts
  - Verify reload behavior for persisted image messages

### Batch 3 (after Batch 2)
- [ ] **Tester**: Task 9 → run build verification

### Dependencies
- Batch 2 depends on Batch 1 because the hook API change (Task 4) must be finalized before route.ts persistence can be tested end-to-end.
- Coder A and Coder B can run in parallel because they touch different files.
- chat-panel.tsx imports from hooks.ts, so Coder A needs to know the new `sendMessage` / `handleSubmit` signatures — provided in plan.

### Risk Areas
- **Data URL size**: Images up to 4MB encoded as base64 data URLs are ~5.3MB in JSON. This is sent in the request body and stored in the DB `parts` JSON field. For MVP this is acceptable but may need Vercel Blob upload for production scale.
- **Object URL cleanup**: `URL.createObjectURL()` previews must be revoked on removal/unmount to prevent memory leaks.
- **Korean IME**: The `isComposing` check in onKeyDown must remain intact — do not break it when adding file submit logic.
- **Suggestion chips**: They call `sendMessage(chip)` with a string only — the new signature must remain backward-compatible (files param is optional).

---

## Done Criteria
- [ ] Users can click attachment button to select images (png/jpeg/webp, ≤4MB)
- [ ] Selected images appear as thumbnail previews in the input area
- [ ] Users can remove individual attachments before sending
- [ ] Messages with images are sent to the AI with correct file parts
- [ ] AI model receives and can reason about attached images
- [ ] User messages with images display inline thumbnails in the chat history
- [ ] Image parts persist to DB and display correctly after page reload
- [ ] Build passes with zero TypeScript errors
- [ ] Send button is enabled when only images are attached (no text required)
- [ ] Existing text-only and suggestion chip flows are unaffected
