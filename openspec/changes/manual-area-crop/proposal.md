## Why

The current "크롭" button (`src/components/gallery-panel.tsx:480` → `export.crop` tRPC mutation) is fully automatic: it runs `sharp.trim({background:"#ffffff"})` to remove whitespace, then composites the trimmed content centered on a square white canvas with 6% padding. The user has **zero control** over the crop region. Many users want to frame a specific part of their logo, crop to a platform-specific aspect ratio (banner, square avatar, 4:5 portrait), or extract a transparent-background crop for external use. The existing auto-crop also loses user control over edges, destroys alpha channels, and doesn't preserve crops as first-class versions in the gallery.

This change introduces a **tabbed crop modal** inside the gallery where users pick between "자동 크롭" (existing whitespace trim, now with preview) and "영역 크롭" (new manual area selection). Both tabs follow a unified 2-step `preview → commit` flow, and both save the committed result as a **new `LogoVersion`** linked to the source via `parentVersionId`, so crops become first-class artifacts that participate in the existing VersionTree (↑↓ navigation, favorites, re-editing, SVG export, etc.). Version metadata is tracked in a new `LogoVersion.metadata Json?` column, storing `{ source, cropRect, sourceVersionId }` — enabling a "✂️ 크롭" badge in the gallery and future features like "같은 영역으로 다시 크롭".

The AI chat dead reference `"크롭해줘" → crop whitespace` in `src/lib/chat/system-prompt.ts:62` (no matching tool exists) is removed; crop remains **UI-only** in v1.

## What Changes

### New capabilities

- **Manual area-selection crop** in the gallery version modal:
  - Tabbed crop modal with "자동 크롭" + "영역 크롭" tabs (content swap inside existing gallery modal — not a second modal)
  - Manual tab uses `react-image-crop` v11 (~12 kB, ISC) with: 4 aspect presets (`1:1`, `4:5`, `16:9`, `자유`), default 80 % centered 1:1 selection, always-on rule-of-thirds grid, 8 handles, real-time `W × H px` size label, desktop-first + basic touch support
  - Unified 2-step preview → commit flow for both tabs (apply button → spinner → preview confirm → new LogoVersion)
  - Keyboard: Enter = apply, Esc = cancel; focus management on modal open/close
  - Cropped result saved as a new LogoVersion linked via `parentVersionId`; gallery auto-navigates to the new version
  - "✂️ 크롭" badge on version cards rendered from `metadata.source`
  - Error UX: toast + keep modal open for retry

### Modified capabilities

- **`export-pipeline`**:
  - Replace single `export.crop` mutation with 4 mutations: `previewAutoCrop`, `previewManualCrop`, `commitCrop`, and keep `crop` as deprecated alias (returns 410 or tombstone after migration)
  - Manual crop uses `sharp.extract({left, top, width, height})`, preserves alpha, no re-padding
  - Auto crop preview surfaces the trimmed+padded output for user confirmation before commit (no side effects until commit)
  - Commit path creates a LogoVersion, writes a UsageLog row (`type='manual_crop'` / `type='auto_crop'`, `imageCostUsd=0`), uploads final PNG to Blob under the new version's standard storage key
  - Input validation: integer coords, non-negative, source-bounds clamping, minimum 10 natural px width AND height
- **`gallery-ui`**:
  - Crop button opens tabbed modal (replaces instant-mutate behavior at line 480)
  - Modal uses the gallery modal's viewport (image area + action bar replaced with crop UI; outer `fixed inset-0` preserved)
  - Version badge: `metadata.source === 'crop_manual' | 'crop_auto'` renders a "✂️ 크롭" pill
  - Applied crop auto-navigates the modal to the new version
- **`version-management`**:
  - New `LogoVersion.metadata Json?` column (nullable, backwards-compatible)
  - Metadata shape: `{ source: 'generate'|'edit'|'upload'|'crop_manual'|'crop_auto', cropRect?: {x,y,width,height}, sourceVersionId?: string }`
  - Existing versions get `metadata = null` (legacy; UI treats null as "generate/edit" depending on `editPrompt` presence — no backfill)
  - Cropped versions use the existing `parentVersionId` field to link to the source version (reuses VersionTree rendering)
- **`usage-tracking`**:
  - `UsageLog.type` gains two string values: `"auto_crop"` and `"manual_crop"`. `imageCostUsd = 0`, `count = 1`, `imageCount = 1`, `blobBytes` set from final upload
- **`ai-chat-engine`**:
  - Remove the dead `"크롭해줘" → crop whitespace` reference from `src/lib/chat/system-prompt.ts:62` (no matching tool exists)
  - Replace with guidance: if user asks to crop, the LLM directs them to the gallery crop button (no tool call)

### Explicit non-goals for v1

- Rotation / straighten
- Pinch-zoom inside crop surface (would require swap to react-easy-crop — documented as v2)
- Arrow-key nudging of crop area
- Screen reader announcements of crop dimensions (aria-live)
- Advanced mobile UX (responsive crop handle sizing, gesture optimization)
- Custom numeric input (e.g. typing "512 × 512")
- AI-driven crop (LLM specifying crop rect programmatically)
- Batch crop (one image at a time)
- Rate limiting (unlimited re-crop on same source version; revisit if abuse detected)
- Crop history browser (versions in gallery serve this purpose)
- Undo within the crop modal (user can restore by switching back to the source version)

## Capabilities

### New Capabilities

None. All changes fit within existing capabilities.

### Modified Capabilities

- `export-pipeline`: Crop path split into preview/commit 2-step flow; new manual crop mutation; both paths create a new LogoVersion.
- `gallery-ui`: Crop button opens tabbed modal (auto + manual); version cards display a crop badge; modal auto-navigates to the new version after commit.
- `version-management`: New `metadata Json?` column on `LogoVersion` to track version provenance.
- `usage-tracking`: `UsageLog.type` gains `"auto_crop"` and `"manual_crop"` string values.
- `ai-chat-engine`: Remove dead `"크롭해줘"` reference from system prompt; LLM redirects crop requests to gallery UI.

## Impact

- **Code**:
  - `src/components/gallery-panel.tsx` — replace instant-mutate crop button with tabbed modal trigger; add crop-mode state, tab UI, react-image-crop integration, version badge rendering, post-commit navigation
  - `src/components/crop-modal.tsx` — **new** — crop modal component (tabs, aspect pills, image surface, action bar, preview state)
  - `src/server/routers/export.ts` — add `previewAutoCrop`, `previewManualCrop`, `commitCrop` mutations; deprecate `crop` (return helpful error)
  - `src/lib/chat/system-prompt.ts` — remove line 62 dead reference, add redirect guidance
  - `prisma/schema.prisma` — add `metadata Json?` to `LogoVersion`
  - `src/lib/storage.ts` — no change needed; `getStorageKey` already accepts any version ID
  - `openspec/specs/export-pipeline/spec.md`, `openspec/specs/gallery-ui/spec.md`, `openspec/specs/version-management/spec.md`, `openspec/specs/usage-tracking/spec.md`, `openspec/specs/ai-chat-engine/spec.md` — delta specs applied on archive

- **Schema**: One migration `add_metadata_to_logo_version` adds `metadata Json?` (nullable — backwards-compatible).

- **Dependencies**: New — `react-image-crop@^11.0.10` (ISC license, ~12 kB min-zipped, React 19 compatible). Adds `react-image-crop/dist/ReactCrop.css` to a client-side import.

- **Env**: No new env vars.

- **Ops**: No deployment-time steps beyond the migration. Existing versions have `metadata = null`; UI treats null as "legacy / unknown source" and renders no badge.

- **Breaking changes**: The legacy `export.crop` mutation signature changes — clients calling it with the old `{logoVersionId}` contract will get a tombstoned error directing them to use `previewAutoCrop` + `commitCrop`. Only our own gallery UI calls this mutation today, so blast radius is zero.
