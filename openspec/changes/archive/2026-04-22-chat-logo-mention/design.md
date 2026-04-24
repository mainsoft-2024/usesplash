# Design: chat-logo-mention

## Goals
1. Users can deterministically point the AI at specific logo versions via `@` mention chips, with multi-mention.
2. The AI receives mentions as **structured data + actual images**, not free text it has to interpret.
3. Zero DB migration; ride on the existing `ChatMessage.parts` JSON.
4. Korean IME safe; backwards compatible with the legacy `"#3 v2"` text pattern.

## Non-Goals
- Mentioning anything other than logo versions (no user/file/project mentions yet).
- Cross-project mentions.
- Inline contentEditable rich-text editor (we keep a plain `<textarea>` and render chips above it).
- Persisting "favorites" or "selection" beyond the lifetime of the composer draft.

## Architecture Overview

```
┌────────────────────────────┐                  ┌────────────────────────────┐
│  Composer (chat-panel.tsx) │  push chip       │  Gallery (gallery-panel.tsx)│
│  ┌──────────────────────┐  │ ◄────────────────│   per-version "@ 인용" btn  │
│  │ chips row (≤3)       │  │   composerStore  │                            │
│  └──────────────────────┘  │   (Zustand)      └────────────────────────────┘
│  ┌──────────────────────┐  │
│  │ <textarea>           │  │  @-trigger → cmdk popup (LogoMentionPicker)
│  └──────────────────────┘  │
│           │ submit         │
└───────────┼────────────────┘
            ▼
   useProjectChat.sendMessage(text, fileParts, mentionParts)
            │
            ▼
   POST /api/chat   body: { messages, projectId }
            │
            ▼
   route.ts:
     1. extract mention parts from latest user message
     2. validate each (logoId/versionId belong to projectId)
     3. fetch image bytes (or pass URL) → assemble image parts
     4. inject image parts into the LLM user message
     5. append imageUrls to allowedReferenceUrls
     6. extend system prompt with a "Mentioned versions" section
     7. tools: edit_logo accepts referencedVersions + outputMode
            │
            ▼
   tool execution → gemini.ts editLogoImage(prompt, sourceBuffer, refBuffers[])
```

## Data Model

### Mention part (in `ChatMessage.parts`)
```ts
type LogoMentionPart = {
  type: "data-mention";
  data: {
    logoId: string;
    versionId: string;
    orderIndex: number;     // 0-based DB index (display: orderIndex + 1)
    versionNumber: number;  // 1-based
    imageUrl: string;       // snapshot at mention time; may 404 if version deleted later
  };
};
```
Stored alongside existing `text` / `file` / `tool-*` parts in the same `parts: any[]` JSON column. No migration.

### `edit_logo` tool schema additions
```ts
{
  logoOrderIndex: z.number(),        // existing, kept for legacy text pattern
  versionNumber: z.number().optional(),
  editPrompt: z.string(),
  referencedVersions: z.array(z.string()).max(3).optional(), // versionIds
  outputMode: z.enum(["new_version", "new_logo"]).optional() // default "new_version"
}
```

When `outputMode === "new_logo"`:
- A new `Logo` row is created with `orderIndex = max(orderIndex)+1` and `prompt = editPrompt`.
- The first `LogoVersion` (versionNumber=1) is the generated result; `parentVersionId` points to the first referenced version (semantic lineage).

When `outputMode === "new_version"` (default):
- Behaves like today: appends a new `LogoVersion` to the resolved target Logo.
- "Target Logo" resolution: prefer explicit `logoOrderIndex`; otherwise the Logo of the **first** mention.

## UI Design

### Composer layout
```
┌─────────────────────────────────────────────────────┐
│  [⨯ #3 v2 🖼️] [⨯ #5 v1 🖼️]              ← chips row │
│  ┌─────────────────────────────────────────────┐    │
│  │ 두 로고를 합쳐서 가로 형태로 만들어줘          │    │ ← textarea
│  └─────────────────────────────────────────────┘    │
│  [📎] [Send]                                         │
└─────────────────────────────────────────────────────┘
```

### `@` popup (cmdk)
- Trigger: `@` typed at start of input or after whitespace AND not inside an IME composition (`e.nativeEvent.isComposing === false`).
- Items: flattened `(logo × version)` list, newest first. Each item:
  ```
  [thumb 40px] #3 v2     2026-04-22
  ```
- Search: matches `^@?(\d+)(?:v(\d+))?` for numeric filter; otherwise free text matched against the version's parent prompt summary.
- Empty gallery: shows `"아직 로고가 없습니다 — 먼저 로고를 생성해주세요."`
- Selection: closes popup, removes the `@token` from textarea, appends a chip (capped at 3 → further `@` opens popup but selection shows toast "최대 3개까지 멘션할 수 있어요").

### Chip
- Components: `Avatar(thumb 24px)` + `#N vM` label + close `×`.
- Removable via `×` click OR `Backspace` when textarea caret is at index 0 and chips exist (removes last chip).
- Click on chip in **history** (read-only): scrolls + highlights gallery card; no removal.

### Gallery entry point
- Each version card gains an icon button "@" (top-right corner, hover-revealed).
- Click → invokes `composerStore.addMention(logoVersion)`. If composer is on a different project, the button is disabled with a tooltip.

### Composer store (Zustand)
```ts
interface ComposerStore {
  mentionsByProject: Record<string, LogoMentionPart["data"][]>;
  addMention(projectId, m): void;     // de-dup by versionId, max 3
  removeMention(projectId, versionId): void;
  clear(projectId): void;
}
```
Source of truth for chips. The textarea's `value` stays plain text. On send: chips → mention parts; clear.

## Backend Flow

### `route.ts` request handling (delta)
```ts
const userMessage = messages[messages.length - 1];
const mentions = userMessage.parts.filter(p => p.type === "data-mention");

// 1. validate
const versions = await prisma.logoVersion.findMany({
  where: {
    id: { in: mentions.map(m => m.data.versionId) },
    logo: { projectId },
  },
  include: { logo: true },
});
if (versions.length !== mentions.length) {
  return new Response("Mentioned logo no longer exists", { status: 400 });
}

// 2. inject image parts (model sees them)
userMessage.parts.push(
  ...versions.map(v => ({
    type: "file" as const,
    mediaType: "image/png",        // assume PNG; fall back via head request if needed
    url: v.imageUrl,
  }))
);

// 3. allow URLs in tool refs
mentionedUrls.forEach(u => allowedReferenceUrls.add(u));

// 4. system prompt addendum
const mentionedSection = renderMentionedVersionsForPrompt(versions);
const systemPrompt = buildSystemPrompt({ projectName, logoCount, mentionedSection });
```

### `edit_logo` execute (delta)
```ts
const refBuffers = await Promise.all(
  (input.referencedVersions ?? []).map(loadImageBuffer)
);
const result = await editLogoImage(input.editPrompt, sourceBuffer, refBuffers);

if (input.outputMode === "new_logo") {
  const orderIndex = await nextOrderIndex(projectId);
  const logo = await prisma.logo.create({ data: { projectId, orderIndex, prompt: input.editPrompt, aspectRatio } });
  return saveAsVersion(logo.id, 1, result, /* parent */ input.referencedVersions[0]);
}
// else default: append version to target logo (existing path)
```

### `lib/gemini.ts` `editLogoImage` (delta)
Add 3rd arg `extraReferences?: { data: string; mimeType: string }[]`. Concatenate before the source image and prepend a small instruction: `"Image 1: source to edit. Images 2..N: style/content references."` Concurrency limiter unchanged (still 2 parallel; multi-image counts as 1 request).

## System Prompt

Append a section only when `mentionedSection` is non-empty:

```
## User-mentioned logo versions (THIS TURN)
The user has explicitly attached the following logo versions to this message.
Treat these as the ground truth subjects of the request.

- mention[0]: logoId=clxxxx orderIndex=#3 versionNumber=v2 — original prompt: "minimal cat mark, monoline"
- mention[1]: ...

When you call edit_logo, pass `referencedVersions: [<versionIds>]`. Decide
`outputMode`:
  - "new_version"  → modifying one of these (default; uses the first as target)
  - "new_logo"     → composing/combining into a brand-new logo entry
```

## Validation & Error Handling

| Case | Behaviour |
|------|-----------|
| Mention versionId no longer exists at submit | Block submit; show inline error under composer; chip greys with "deleted" label. History keeps the chip in `disabled` state. |
| > 3 mentions attempted | Toast `"최대 3개"`; popup selection no-op. |
| Project mismatch (gallery from another project) | Gallery "@" button disabled. |
| LLM ignores mention parts and references nothing | No special handling — model has the images and prompt context; degrades gracefully. |
| `outputMode: new_logo` but `referencedVersions` empty | Server falls back to `new_version`. |

## Backwards Compatibility

- Legacy `"#3 v2"` text references still work; system prompt continues to support them. Chips are an *addition*, not a replacement.
- Existing `ChatMessage` rows have no `data-mention` parts — renderer treats their absence as a no-op.
- `edit_logo` legacy callers omit `referencedVersions`/`outputMode` → identical behaviour to today.

## Risks / Mitigations

| Risk | Mitigation |
|------|------------|
| `cmdk` portal vs textarea focus loss | Use `cmdk`'s `Command.Dialog` controlled mode; reposition under caret using a measuring `<span>` mirror (standard mention pattern). Fallback to anchor-to-input-bottom. |
| Gemini cost: 4 images × ~3k tokens × N requests | Cap mentions at 3, document expected billing impact in PR description. |
| Mention image 404 mid-conversation | Validate at submit and before tool exec; show degradation message. |
| Zustand state leaking across project switches | Key all state by `projectId`; clear on route change via effect. |
| `ChatMessage.parts` schema drift | Add a Zod schema `MessagePartSchema` and parse on read in `MessageList` to ignore unknown parts safely. |

## Testing Strategy

1. **Unit** (Vitest):
   - Composer store: add/remove/dedupe/cap-at-3, project keying.
   - Mention part schema parse/serialize.
   - System prompt renderer with 0/1/3 mentions.
   - `edit_logo` handler `outputMode` branching.
   - Server-side mention validation (missing versionId → 400).
2. **Component** (Vitest + Testing Library):
   - `@`-trigger detection respects IME composition.
   - Backspace at caret 0 removes last chip.
   - Cap toast at 4th selection.
3. **E2E** (Playwright, 1 happy-path):
   - Generate 2 logos → open composer → `@` → pick #1 v1 + #2 v1 → "두 로고 합쳐줘" → assert tool call had `outputMode=new_logo` + 2 versionIds → new logo row appears in gallery.

## Rollout

Single PR, no feature flag (the feature is purely additive, no risk to existing flows). Monitor `chat` route error rate for 24h post-deploy.
