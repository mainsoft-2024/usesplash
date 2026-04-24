## 1. Dependencies & Shared State

- [x] 1.1 Add `cmdk` to `web/package.json` (`pnpm add cmdk`)
- [x] 1.2 Create `web/src/lib/chat/composer-store.ts` (Zustand store keyed by projectId: `mentionsByProject`, `addMention`, `removeMention`, `clear`; cap 3, dedupe by versionId)
- [x] 1.3 Create `web/src/lib/chat/mention-types.ts` exporting `LogoMentionData` + `LogoMentionPart` types and a Zod schema `LogoMentionPartSchema`

## 2. Composer UI — `@` Mention

- [x] 2.1 Create `web/src/components/chat/mention-chip.tsx` (avatar + `#N vM` + `×`, `disabled` variant for deleted)
- [x] 2.2 Create `web/src/components/chat/logo-mention-picker.tsx` using `cmdk` Command primitive: receives `versions`, fires `onSelect`; supports numeric filter (`3`, `3v2`); empty-state copy `"아직 로고가 없습니다"`
- [x] 2.3 Modify `web/src/components/chat-panel.tsx`:
  - render chips row above textarea from `composerStore`
  - detect `@` trigger in `onChange` (IME-safe: skip while `isComposing`); position picker at caret using mirror-span
  - on selection: remove the `@token` from textarea, call `composerStore.addMention`
  - Backspace at caret 0 removes last chip
  - cap toast at 4th selection attempt

## 3. Composer Submit Wiring

- [x] 3.1 Modify `web/src/lib/chat/hooks.ts`: extend `sendMessage(content, fileParts, mentionParts)` to append mention parts to the user message
- [x] 3.2 In `chat-panel.tsx submitMessage()`: serialize `composerStore.mentionsByProject[projectId]` → `mentionParts`, pass to `sendMessage`, then `composerStore.clear(projectId)`

## 4. Gallery Entry Point

- [x] 4.1 In `web/src/components/gallery-panel.tsx`: add per-version "@ 인용" icon button (hover-revealed, top-right of version thumb)
- [x] 4.2 Wire button → `composerStore.addMention({ logoId, versionId, orderIndex, versionNumber, imageUrl })`; disable when `composerProjectId !== currentProjectId` with tooltip

## 5. Chat History — Render Mention Chips

- [x] 5.1 In the user-message renderer inside `chat-panel.tsx` (or its `MessageList` subcomponent): detect `data-mention` parts, render as read-only chips above the message text
- [x] 5.2 Click on history chip → scroll gallery + briefly highlight matching version card (use a small `gallerySpotlightStore` or DOM ID `logo-version-{id}`)
- [x] 5.3 Versions that no longer exist in current gallery render as greyed `disabled` chip with "삭제됨" label

## 6. Backend — `/api/chat` Mention Pipeline

- [x] 6.1 In `web/src/app/api/chat/route.ts`: parse `data-mention` parts from latest user message; collect `versionIds`
- [x] 6.2 Validate via Prisma: `logoVersion.findMany({ where: { id: { in: ids }, logo: { projectId } } })`; if mismatch → 400 with JSON `{ error: "mention_invalid", missingVersionIds }`
- [x] 6.3 Append `{ type: "file", mediaType: "image/png", url }` parts to the user message for each mention so the LLM receives the images
- [x] 6.4 Add each `imageUrl` to the existing `allowedReferenceUrls` set
- [x] 6.5 Build `mentionedSection` string (id, orderIndex, versionNumber, prompt summary, max 200 chars) and pass to `buildSystemPrompt`

## 7. System Prompt Update

- [x] 7.1 In `web/src/lib/chat/system-prompt.ts`: extend `buildSystemPrompt` signature with `mentionedSection?: string`; render the addendum block ONLY when non-empty (template per design.md "System Prompt" section)
- [x] 7.2 Add a one-paragraph note at the top of the prompt explaining mentions exist and that `referencedVersions` should be passed to `edit_logo` when the user mentioned versions

## 8. `edit_logo` Tool Schema + Handler

- [x] 8.1 In `route.ts` `edit_logo` tool: extend Zod input with `referencedVersions: z.array(z.string()).max(3).optional()` and `outputMode: z.enum(["new_version","new_logo"]).optional()`
- [x] 8.2 Resolve `referencedVersions` to `{ buffer, mimeType }[]` (download from `imageUrl` with the existing fetch helper)
- [x] 8.3 Call updated `editLogoImage(prompt, sourceBuffer, refBuffers)` (see task 9)
- [x] 8.4 If `outputMode === "new_logo"`: create new `Logo` row (next `orderIndex`, `prompt = editPrompt`, inherit `aspectRatio`); save result as `versionNumber: 1` with `parentVersionId = referencedVersions[0]`
- [x] 8.5 Else (default): existing append-version path; "target Logo" = explicit `logoOrderIndex` if provided, else Logo of `referencedVersions[0]`
- [x] 8.6 If `outputMode === "new_logo"` but `referencedVersions` empty → silently fall back to `new_version`

## 9. `lib/gemini.ts` — Multi-Reference Edit

- [x] 9.1 Extend `editLogoImage(prompt, sourceImageBuffer, extraReferences?)` with optional 3rd arg (`{ data: string; mimeType: string }[]`); cap total inputs at 4
- [x] 9.2 Build `contents` as `[source, ...refs, instructionText, prompt]` where `instructionText = "Image 1: source to edit. Images 2..N: reference for style/content."`; only include the instruction line when refs exist
- [x] 9.3 Keep concurrency limiter + retry behaviour unchanged

## 10. Tests

- [x] 10.1 Vitest: `composer-store.test.ts` (add/remove/dedupe/cap-3/project-key/clear)
- [x] 10.2 Vitest: `mention-types.test.ts` (Zod parse round-trip, reject malformed)
- [x] 10.3 Vitest: `system-prompt.test.ts` (no mentions = no addendum; 3 mentions = correct block)
- [x] 10.4 Vitest: `edit-logo-handler.test.ts` (outputMode branching, fallback empty refs, target resolution by first mention)
- [x] 10.5 Vitest: `chat-route-mention-validation.test.ts` (missing versionId → 400, cross-project versionId → 400)
- [x] 10.6 Component: `chat-panel.mention.test.tsx` (`@`-trigger, IME composition skip, Backspace removes last chip, cap toast)
- [x] 10.7 Playwright E2E: `mention-flow.spec.ts` — generate 2 logos → mention both → submit "두 로고 합쳐줘" → assert new logo row in gallery

## 11. Verification & Cleanup

- [x] 11.1 `pnpm --filter web typecheck` passes (or `pnpm build` in `web/`)
- [x] 11.2 `pnpm --filter web test` passes
- [x] 11.3 Playwright run passes locally
- [x] 11.4 Manual smoke: empty gallery `@` shows hint; gallery "@ 인용" button works; chip removal both ways; legacy `#3 v2` text still works
- [x] 11.5 Update `web/AGENTS.md` (or root `AGENTS.md`) "Architecture Decisions" with a short "Logo mentions" subsection
