## Context

- Current crop: `src/server/routers/export.ts` lines 10–57. `export.crop` mutation takes `{ logoVersionId }`, fetches the source PNG, runs `sharp.trim({background:"#ffffff", threshold:20})`, composites centered on a square white canvas with 6 % padding, uploads as `${versionId}-cropped.png` to Vercel Blob, returns `{ url, key }`. Triggered by one button in `src/components/gallery-panel.tsx:480`. No UsageLog. No AI integration (despite a dead `"크롭해줘" → crop whitespace` line in `src/lib/chat/system-prompt.ts:62` — no matching tool defined in `src/app/api/chat/route.ts`).
- Gallery modal: `src/components/gallery-panel.tsx` lines 417–488. Full-screen overlay (`fixed inset-0 bg-[rgba(0,0,0,0.92)] z-50`) opened by `modalIdx` state; keyboard nav (Esc/←/→/↑/↓/F) wired in a useEffect at lines 122–131; image rendered as plain `<img>` at line 425.
- Logo version data model: `prisma/schema.prisma` lines 84–101. `LogoVersion { id, logoId, versionNumber, parentVersionId, imageUrl, svgUrl?, s3Key, editPrompt?, chatMessageId?, createdAt }`. **No metadata field.** `parentVersionId` already used to form VersionTree (AI edit chains).
- Existing conventions:
  - Preview-commit multi-step mutations have precedent in the codebase (not for crop yet, but the 2-step `previewAutoCrop → commitCrop` pattern matches a "dry run → commit" UX used in Canva, Figma, iOS Photos crop).
  - tRPC mutation pattern: `trpc.export.<mutation>.useMutation()` with `onSuccess`/`onError` callbacks; `sonner` toast for errors.
  - Storage: `getStorageKey(userId, projectId, logoId, versionId, ext)` in `src/lib/storage.ts`. For first-class versions, use the new `versionId` as the fragment.
  - UsageLog: `UsageLog.type` is a free-form String (see `prisma/schema.prisma:131` `// "generate" | "edit" | "llm" | "vectorize"`). Aggregation queries group by `type`, so adding `"auto_crop"` and `"manual_crop"` requires **no** schema change.
- Research documents (in `.slash/workspace/research/`):
  - `spec-manual-crop-library-comparison.md` — `react-image-crop v11` chosen (ISC, ~12 kB min-zipped, React 19 compatible, owns its `<img>` so we overlay styling, free + aspect-locked, rule-of-thirds built in)
  - `spec-manual-crop-sharp-patterns.md` — `sharp.extract({left,top,width,height})` with integer coords, bounds clamping, min 10 px; preserve alpha; no re-padding (user-selected region as-is)
  - `spec-manual-crop-ux-patterns.md` — unified tabbed modal pattern, aspect pills, rule-of-thirds always-on, preview → confirm → commit flow

## Goals / Non-Goals

**Goals:**
- Give users precise control over the cropped region (drag a selection rectangle).
- Preserve first-class version semantics: crop results are LogoVersions, navigable, re-editable, re-exportable as SVG.
- Unified UX: both auto and manual crops go through the same preview → confirm → commit flow.
- Track crop provenance (source version, rect) on the new version for future features and debugging.
- Zero external-API cost (CPU-only sharp), but still logged in `UsageLog` for product analytics.
- No UX regression: existing auto-crop-like behavior remains accessible via the "자동 크롭" tab.

**Non-Goals (v1):**
- Rotation / straighten / flip.
- Pinch-zoom inside crop surface (v2 — would require swapping to react-easy-crop).
- Arrow-key nudging / numeric input / Shift-drag modifiers.
- Screen reader announcements of live crop dimensions (v2).
- AI-triggered crop (LLM tool) — crop stays user-UI-only.
- Rate limiting / quota enforcement (revisit if abuse detected).
- Batch crop, history browser, undo-within-modal.

## Decisions

### 1. Crop results are first-class LogoVersions linked via `parentVersionId`
**Why:** Users asked for this explicitly (interview Q5). Cropped images participate in the existing version tree (↑↓ nav, favorites, SVG export, re-editing). Reusing `parentVersionId` means the gallery's existing VersionTree rendering works for crops with zero changes.
**Contrast with SVG export change (2026-04-22):** That change stored `svgUrl` on the **same** version because SVG is a derivative rendering of the same logo content. Crop produces a genuinely different image (different pixel dimensions, different framing) — it deserves its own version row.
**Implication:** `versionNumber` auto-increments within the logo (existing logic handles this); `parentVersionId` = source version; `chatMessageId = null` (not from chat).

### 2. Store crop metadata in a new `LogoVersion.metadata Json?` column
**Why:** Interview Q28 — metadata field is the most extensible option. A single `Json?` column holds `{source, cropRect, sourceVersionId}` today, and leaves room for future metadata (upload provenance, edit parameters, etc.) without more schema churn.
**Shape:**
```ts
type LogoVersionMetadata = {
  source: 'generate' | 'edit' | 'upload' | 'crop_manual' | 'crop_auto'
  cropRect?: { x: number; y: number; width: number; height: number } // natural image pixels
  sourceVersionId?: string // redundant with parentVersionId but explicit for crop semantics
}
```
**Alternatives rejected:**
- Dedicated columns (cropRect Json, sourceVersionId, source) — three columns for one feature, fights generic extensibility.
- Stuffing JSON into `editPrompt` text field — fragile, leaks into chat UI if mistakenly rendered.
- No storage — disables "✂️ 크롭" badge rendering and future "crop again" feature.
**Existing versions:** `metadata = null`; UI treats null as "legacy", renders no source badge.
**Backfill:** None — greenfield, backwards-compatible.

### 3. Tabbed modal with 2-step preview → commit flow (both tabs)
**Why:** Interview Q1, Q6, Q31 — unified UX across auto and manual. Preview eliminates "surprise results" (user sees trim output before committing; manual user sees exact extract). Also removes the need for client-side canvas rendering of sharp output.
**Flow:**
1. User clicks "크롭" button in gallery modal → content of the gallery modal swaps from image-view to crop-view (outer `fixed inset-0` remains — no modal-on-modal).
2. Tab bar at top: [자동 크롭] [영역 크롭]. Default to [영역 크롭] when opening (power-user path; auto-crop users can always switch).
3. Manual tab shows `react-image-crop` selector + aspect pills + grid + size label + `[취소] [미리보기]` buttons.
4. Auto tab shows a one-line description ("여백을 자동으로 제거하고 정사각으로 맞춥니다") + `[취소] [미리보기]` button.
5. Clicking "미리보기" → calls `previewAutoCrop` or `previewManualCrop` → server returns a preview image URL (NOT a LogoVersion). UI swaps to "preview mode": shows output image + `[다시 자르기] [적용]` buttons.
6. Clicking "적용" → calls `commitCrop(previewId)` → server creates LogoVersion + uploads final PNG + writes UsageLog. UI swaps back to image-view mode in the gallery modal, auto-selects the new version.
7. Clicking "취소" at any step → reverts to image-view mode; any preview blob stays orphaned (cleaned up by TTL — see decision 5).
**Alternatives rejected:**
- Instant one-shot mutation (current behavior) — no preview, conflicting with interview Q6.
- Two separate entry buttons (auto + manual) — rejected in interview Q1 in favor of one tabbed modal.
- Modal-on-modal — forbidden by interview Q22.

### 4. `sharp.extract` for manual, `sharp.trim + composite` unchanged for auto; **preserve alpha** on manual
**Why:** Manual crop preserves alpha (interview Q8) — users who uploaded transparent PNGs expect transparent crops. Auto crop keeps white-background behavior (existing trim logic assumes white bg for threshold detection).
**Manual pipeline:**
```ts
const img = sharp(buffer)
const { width: natW, height: natH } = await img.metadata()
// Validate rect: integers, non-negative, within bounds, min 10x10
const rect = clampAndValidate(input.rect, natW, natH) // throws on invalid
const out = await img.extract({ left: rect.x, top: rect.y, width: rect.width, height: rect.height })
  .png({ compressionLevel: 9 })
  .toBuffer()
```
**Auto pipeline:** Unchanged from today (`trim({background:"#ffffff"})` + composite on white square).
**Validation rules (server-side, manual):**
- `x, y, width, height` all integers, non-negative
- `x + width <= naturalWidth`, `y + height <= naturalHeight` — if out of bounds → **clamp** (not reject). Client also clamps.
- `width >= 10 && height >= 10` natural pixels — reject with `BAD_REQUEST` if below.

### 5. Preview storage: ephemeral Blob with opaque `previewId`
**Why:** Preview must be viewable in the browser (data URLs tank UX at 500 kB+); must be cheap (one sharp call + one short-lived Blob upload); must not pollute version tree.
**Implementation:**
- `previewAutoCrop` / `previewManualCrop` run sharp → upload to Blob under a preview-specific key prefix: `preview/${userId}/${randomId}.png`
- Return `{ previewId, previewUrl }` to the client
- `commitCrop({ previewId, source, rect?, sourceVersionId })` re-runs sharp (not reusing the preview upload — see below) and uploads to the final `getStorageKey(...)` under the new version's ID
- Preview blobs: no explicit cleanup in v1 — we accept a small storage waste. A nightly cleanup job can be added in v2 if needed.
**Why re-run sharp on commit instead of promoting the preview blob?**
- Simpler: no need to track preview → commit blob moves.
- Safe: `commitCrop` receives the authoritative `{sourceVersionId, rect}` and re-computes; if the client spoofs `previewId` with a different rect, we fail closed because commit only trusts the passed rect.
- CPU cost is trivial (sharp ~50 ms for a typical logo).

### 6. UsageLog: `type='manual_crop'` or `'auto_crop'`, cost=0
**Why:** Interview Q11 — track crop usage for analytics even though no external API cost. Consistent with how `vectorize` and `edit` are logged. Downstream admin dashboards pick up new types automatically because `UsageLog.type` is a free-form string (existing vectorize change confirmed this pattern).
**Row shape:**
```ts
{
  userId, projectId, type: 'auto_crop' | 'manual_crop',
  count: 1, imageCount: 1, model: null,
  imageCostUsd: 0, blobBytes: <committed-blob-size>, blobCostUsd: <computed>,
  createdAt: now
}
```
Written **only on commit** (previews do not log).

### 7. Client library: `react-image-crop` v11 (ISC)
**Why:** Interview Q26 confirmed. Research comparison doc chose it over `react-easy-crop` / `react-advanced-cropper` / `react-cropper` / custom based on bundle size, React 19 compat, ownership of `<img>` (easier Tailwind styling + re-use of existing preview image), and freeform + aspect-locked UX that matches pro crop tools.
**Install:** `pnpm add react-image-crop@^11.0.10`
**CSS import:** one-time client-side `import "react-image-crop/dist/ReactCrop.css"` in the crop modal component.

### 8. Deprecate legacy `export.crop` mutation (safe — only internal caller)
**Why:** The existing `export.crop` has incompatible semantics (instant side-effect, no preview, blob-only output — no version row). Keeping it creates dead surface area and temptation for new callers. Since the only caller is `src/components/gallery-panel.tsx` which we are updating in this same change, we can **safely delete** it.
**Decision:** Remove `export.crop`. Clients calling it get a tRPC 404 (endpoint not found). Client-side, replace all callsites with `previewAutoCrop + commitCrop` or `previewManualCrop + commitCrop`.
**Alternative considered:** Tombstone `crop` with a descriptive error → rejected (no external callers; cleanup preferred).

### 9. Auto-navigate gallery to the new version after commit
**Why:** Interview Q25 — after "적용" click, user expects to see the cropped result. Trivial to implement: after `commitCrop.onSuccess`, invalidate logo/versions query, then set `modalIdx` / `activeIdx` to point to the new version once it's in the query data.
**Edge case:** If version list is stale and the new version hasn't appeared yet, wait for `tRPCQuery.isFetching` to settle, then navigate. Fallback: navigate to the last version in the new list (newest version = cropped version because `createdAt` is monotonic).

### 10. Remove dead system-prompt reference; no AI crop tool
**Why:** Interview Q13, Q14. The line at `src/lib/chat/system-prompt.ts:62` (`"크롭해줘" → crop whitespace`) points to a non-existent tool. The LLM may currently invent a tool call that gets rejected, or produce confusing language. Removing it cleans up the prompt. Replacement guidance: "사용자가 크롭을 요청하면, 갤러리 모달의 '크롭' 버튼을 안내한다. 어시스턴트가 직접 크롭을 실행할 수 없다."

### 11. Crop badge rendering: `metadata.source`-driven
**Why:** Interview Q20, Q29. Single source of truth in DB, no fragile string parsing. Badge text: "✂️ 크롭" for both `crop_manual` and `crop_auto` (users don't need to distinguish from the badge — the version tree already shows lineage). Hovering the badge shows a tooltip "수동 크롭" or "자동 크롭".
**Fallback for null metadata (legacy versions):** No badge.

### 12. Minimum crop size: 10 natural pixels × 10 natural pixels
**Why:** Research doc (`spec-manual-crop-sharp-patterns.md`) recommends enforcing a minimum to prevent 1×1 garbage. 10 px chosen as a low but non-trivial floor that even tiny logos (256×256) can reach with ~4 % of the image area. Client-side `minWidth`/`minHeight` props on `ReactCrop` enforce this visually; server-side re-validates and throws `BAD_REQUEST` ("크롭 영역이 너무 작습니다") if violated.

## Risks / Trade-offs

- **Preview blob orphaning** — Preview uploads with no commit stay in Blob storage indefinitely in v1. Mitigation: prefix `preview/` for easy targeting by a future cleanup job; storage cost per orphan ~10–100 kB × low commit-abandonment rate = negligible in year 1. Revisit if volume grows.
- **Double sharp work on commit** — Preview runs sharp, commit runs it again. ~50–100 ms extra server time per crop. Trade-off: simpler security model (commit doesn't trust preview identity) vs. tiny latency. Acceptable.
- **Version count explosion** — Unlimited re-crop on same source creates many versions (interview Q32). Mitigation: user controls cleanup via existing version deletion. Gallery UI already handles many versions per logo (↑↓ paginated nav).
- **React 19 + react-image-crop** — Library's peer dep is `react >= 16.13.1`, so no version ceiling, but library hasn't explicitly tagged a React 19 release. Mitigation: pin `^11.0.10` (published 2025-04); revisit if React 19 dev-tools warnings appear. Fallback: switch to `react-easy-crop` (backup choice in research doc).
- **`touch-action: none` on the crop surface** — Required to prevent iOS Safari page zoom interfering with drag. Must be set in CSS on the wrapping container. Risk: if we forget, mobile UX degrades. Tasks include explicit verification.
- **Transparent PNG edge cases** — User uploads a transparent PNG → auto-crop `trim({background:"#ffffff"})` may not detect edges correctly (alpha-only edges are not "white"). Current behavior already has this limitation; we document it as known and let users use the manual tab for transparent sources.
- **Metadata schema flexibility** — `Json?` is unvalidated at DB level. Mitigation: use a Zod schema to validate on read/write (inside tRPC router). Risk: DB-bypass writes (e.g., admin tooling) could insert malformed metadata. Acceptable for v1.
- **Cross-origin preview image** — Preview image is served from Vercel Blob (cross-origin to `usesplash.vercel.app`). `react-image-crop` doesn't need canvas access, so `crossOrigin="anonymous"` is optional; required only if we later add a client-side canvas preview (not planned for v1).

## Migration Plan

1. Run `npx prisma migrate dev --name add_metadata_to_logo_version` (adds `metadata Json?` on `LogoVersion`, backwards-compatible).
2. Run `npx prisma generate` to regenerate the Prisma client types.
3. Deploy server code (new `preview*` and `commitCrop` mutations; old `crop` deleted).
4. Deploy client code (new crop modal; gallery panel wired to new flow; version badge renders for new versions).
5. Verify manual tests in the verification section of tasks.md.
6. No data backfill: existing versions keep `metadata = null`, no badge, no regressions.
7. Rollback: revert deploys; `metadata` column is nullable, no data loss.

## Open Questions

None — all resolved during interview rounds (see `.slash/workspace/plans/spec-manual-crop-interview-2026-04-24.md`).
