## Why

Today users can only refer to logos via free-text patterns like `"#3 v2"`, which the LLM has to parse correctly. This is brittle: the LLM sometimes guesses the wrong logo, often defaults to "the latest one", and there is no UX affordance that tells users they can disambiguate. As soon as a project has more than ~3 logos / many versions, "edit *that* logo, but use *this* one as a color reference" becomes unreliable.

We want a first-class, structured way to mention specific logo **versions** in a chat message — typed via `@` autocomplete in the input, draggable from the gallery, rendered as chips in both the composer and the chat history, and passed to the AI as concrete image attachments rather than as text the model has to interpret.

## What Changes

- **`@` mention in chat composer**: typing `@` opens an autocomplete popup listing every logo version (flattened) with thumbnail, `#N vM`, and creation date. Numeric input filters (`@3` → logo #3, `@3v2` → logo #3 v2). Selection inserts a **chip** rendered in a row above the textarea, not inline.
- **Multi-mention**: up to **3** chips per message (matches Gemini multi-image guidance + UX clarity).
- **Gallery "@ 인용" entry point**: each version card in the gallery panel gets a small button that injects that version as a chip into the composer.
- **Wire format**: a sent message carries plain `text` plus a structured `attachments: [{ logoId, versionId, versionNumber, orderIndex, imageUrl }]` array (not embedded tokens). Persisted in `ChatMessage.parts` JSON via a new `data-mention` part (no DB schema change).
- **History rendering**: past messages render mention chips inline-above-text exactly like the composer; clicking a historical chip highlights the version in the gallery.
- **Validation**: at submit time, mentioned versions are verified to still exist; missing ones produce an inline error and a greyed-out chip in history.
- **AI handoff**:
  - System prompt enumerates **only mentioned** versions (id, orderIndex, versionNumber, prompt summary) — token-efficient.
  - Mentioned images are injected into the LLM message as AI SDK v6 **image parts** so the model can actually *see* them, not just read URLs.
  - `edit_logo` tool gets a new optional field `referencedVersions: string[]` (versionIds). The LLM decides whether the edit becomes a new version of an existing logo or a brand-new logo (new tool flag `outputMode: "new_version" | "new_logo"`); for "new_logo" path a new `Logo` row with the next `orderIndex` is created.
  - Backend `allowedReferenceUrls` set is augmented with the mentioned versions' image URLs so the existing URL guard does not reject them.
- **Backwards compatibility**: existing free-text patterns (`#3 v2`) keep working — system prompt encourages the new mention chips but does not forbid the legacy form.

## Capabilities

### Modified Capabilities
- `ai-chat-engine`: structured logo-version mention parts in messages; system prompt + LLM image-part injection for mentioned versions; `edit_logo` tool gains `referencedVersions` and `outputMode`; `allowedReferenceUrls` includes mentioned URLs; mention validation at submit.
- `gallery-ui`: each version card exposes a "@ 인용" action that pushes a chip into the active project's chat composer.

### New Capabilities
None — all changes extend existing capabilities.

## Impact

- **Database**: no schema change. `ChatMessage.parts` JSON gains a new part shape `{ type: "data-mention", data: { logoId, versionId, versionNumber, orderIndex, imageUrl } }`.
- **API**:
  - `/api/chat` request body keeps `messages: UIMessage[]` shape (mention parts ride inside `parts`).
  - `edit_logo` tool schema gains `referencedVersions?: string[]` and `outputMode?: "new_version" | "new_logo"`.
- **UI**:
  - `chat-panel.tsx`: composer rewritten to render a chips row above the textarea, an `@`-trigger popup (cmdk-based), Backspace/X chip removal, IME-safe trigger detection.
  - `gallery-panel.tsx`: per-version "@ 인용" button + a lightweight bridge (Zustand or React context) so the gallery can push chips into the composer.
  - `MessageList`: renders historical `data-mention` parts as chips with click-to-highlight.
- **Backend**:
  - `route.ts`: mention parts are extracted from incoming user message → resolved to `{versionId, imageUrl}` (verified against DB) → injected as image parts into the LLM message + appended to `allowedReferenceUrls` + summarised in the system prompt; `edit_logo` handler honours `referencedVersions` + `outputMode`.
  - `lib/gemini.ts`: `editLogoImage` extended to accept additional reference image buffers (Gemini supports up to 14 inputs; we cap at 4 = 1 source + 3 refs).
- **Dependencies**: add `cmdk` (~5KB) for the popup primitive.
- **Limits**: max 3 mentions per message, IME-safe `@` trigger, mentioned-but-deleted versions surface as a submit-time error.
