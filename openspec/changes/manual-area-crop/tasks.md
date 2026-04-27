## 1. Dependency & Schema

- [x] 1.1 Add `react-image-crop@^11.0.10` via `pnpm add react-image-crop@^11.0.10`
- [x] 1.2 Add `metadata Json?` column to `LogoVersion` in `prisma/schema.prisma`
- [x] 1.3 Run `npx prisma migrate dev --name add_metadata_to_logo_version`
- [x] 1.4 Run `npx prisma generate` to update generated client types
- [x] 1.5 Add `LogoVersionMetadata` Zod schema in `src/lib/logo-version-metadata.ts` (new file) with strict types for `{ source, cropRect?, sourceVersionId? }`

## 2. Server: export router — preview mutations

- [x] 2.1 Delete the existing `crop` mutation body in `src/server/routers/export.ts` (lines 10–57) — will be fully replaced, no backwards-compatible alias
- [x] 2.2 Add `previewAutoCrop` protected mutation:
  - [x] 2.2.1 Input: `z.object({ logoVersionId: z.string() })`
  - [x] 2.2.2 Fetch version + authorize (userId match on `version.logo.project.userId`) — reuse existing auth pattern
  - [x] 2.2.3 Run existing auto-trim pipeline (`sharp(buf).trim({background:"#ffffff", threshold:20})` + square-pad with 6 % white padding + `.png()`)
  - [x] 2.2.4 Upload preview buffer to `preview/${userId}/${crypto.randomUUID()}.png` via `uploadImage(key, buf)`
  - [x] 2.2.5 Return `{ previewUrl, previewKey, naturalWidth, naturalHeight }` (no UsageLog, no LogoVersion created)
- [x] 2.3 Add `previewManualCrop` protected mutation:
  - [x] 2.3.1 Input: `z.object({ logoVersionId: z.string(), rect: z.object({ x: z.number().int().min(0), y: z.number().int().min(0), width: z.number().int().min(10), height: z.number().int().min(10) }) })`
  - [x] 2.3.2 Fetch version + authorize (same as 2.2.2)
  - [x] 2.3.3 Fetch source image, read `sharp(buf).metadata()` for naturalWidth/naturalHeight
  - [x] 2.3.4 Clamp rect to source bounds (`x = min(x, natW-1)`, `width = min(width, natW - x)`, etc.) — throw `BAD_REQUEST` if resulting rect < 10×10
  - [x] 2.3.5 Run `sharp(buf).extract({ left, top, width, height }).png({ compressionLevel: 9 }).toBuffer()` — **do not** composite on white; preserve alpha
  - [x] 2.3.6 Upload preview buffer to `preview/${userId}/${crypto.randomUUID()}.png`
  - [x] 2.3.7 Return `{ previewUrl, previewKey, clampedRect }` (no UsageLog, no LogoVersion)

## 3. Server: export router — commit mutation

- [x] 3.1 Add `commitCrop` protected mutation:
  - [x] 3.1.1 Input: `z.object({ sourceVersionId: z.string(), source: z.enum(["crop_auto", "crop_manual"]), rect: z.object({ x:..., y:..., width:..., height:... }).optional() })` (rect required iff `source === "crop_manual"`)
  - [x] 3.1.2 Fetch source version + authorize
  - [x] 3.1.3 Re-run sharp pipeline (auto-trim for `crop_auto`; `extract` for `crop_manual` with same clamp+validate logic as 2.3.4/2.3.5)
  - [x] 3.1.4 Determine next `versionNumber` for the logo (`max(versionNumber) + 1` scoped to `logoId`)
  - [x] 3.1.5 Use Prisma transaction to:
    - Create new `LogoVersion` with `logoId`, `versionNumber`, `parentVersionId = sourceVersionId`, `chatMessageId = null`, `editPrompt = null`, `imageUrl = <placeholder>`, `s3Key = <placeholder>`, `metadata = { source, cropRect: rect ?? null, sourceVersionId }`
    - Get the new version's ID
  - [x] 3.1.6 Call `getStorageKey(userId, projectId, logoId, newVersionId, "png")` for final key; upload buffer via `uploadImage(key, buf)` → get `{ url, bytes }`
  - [x] 3.1.7 Update the new LogoVersion’s `imageUrl` and `s3Key` with real values (second Prisma statement in same transaction)
  - [x] 3.1.8 Write `UsageLog` row: `{ userId, projectId, type: source, count: 1, imageCount: 1, model: null, imageCostUsd: 0, blobBytes: bytes, blobCostUsd: blobCost(bytes) }`
  - [x] 3.1.9 Return `{ newVersion: { id, versionNumber, imageUrl, metadata } }`
- [x] 3.2 Ensure rect validation rejects `width < 10` OR `height < 10` (server-side) with TRPCError code `"BAD_REQUEST"` and message `"크롭 영역이 너무 작습니다 (최소 10×10px)"`
- [x] 3.3 Ensure source-not-found / unauthorized access yields TRPCError `"NOT_FOUND"` / `"FORBIDDEN"` respectively (mirror existing patterns in `vectorize`)

## 4. Server: logo router — expose metadata

- [x] 4.1 In `src/server/routers/logo.ts` ensure the `select`/`include` for LogoVersion rows in the listing query exposes the `metadata` field to the client (check existing `get` / `list` queries and add `metadata: true` to select clause if using explicit selects)
- [x] 4.2 If Prisma is returning versions implicitly (`include: { versions: true }`), metadata comes through automatically — just verify via `npx prisma generate` + type check

## 5. Server: AI chat — remove dead reference

- [x] 5.1 In `src/lib/chat/system-prompt.ts`:
  - Delete the line `- "크롭해줘" → crop whitespace` (line ~62)
  - Replace with: `- "크롭해줘" / "자를 수 있어?" → 어시스턴트는 크롭을 직접 실행할 수 없다. 사용자에게 갤러리 모달의 '크롭' 버튼을 안내한다.`
- [x] 5.2 Also remove / update line ~63 (`"배경 제거해줘" / "SVG로 변환해줘" → ... PNG/크롭만 제공`) so "PNG/크롭" wording still matches after the tool description changes (crop is still offered, just through UI)

## 6. Client: new CropModal component

- [x] 6.1 Create `src/components/crop-modal.tsx` (new file, `"use client"`):
  - [x] 6.1.1 Import `ReactCrop, { centerCrop, makeAspectCrop, type PixelCrop, type Crop }` from `react-image-crop`
  - [x] 6.1.2 One-time CSS import at the top: `import "react-image-crop/dist/ReactCrop.css"`
  - [x] 6.1.3 Props: `{ sourceVersion: { id, imageUrl }, onClose: () => void, onCommitted: (newVersion) => void }`
  - [x] 6.1.4 State: `tab`, `aspect`, `crop`, `completedCrop`, `stage`, `previewUrl`
  - [x] 6.1.5 `imgRef = useRef<HTMLImageElement>(null)` for natural-pixel coordinate conversion
  - [x] 6.1.6 Render top tab bar with two tabs
  - [x] 6.1.7 Render image area with `max-w-[85vw] max-h-[55vh]` and `touch-action: none` on the ReactCrop wrapper (mobile)
  - [x] 6.1.8 Render aspect pills below the image (manual tab only)
  - [x] 6.1.9 Render real-time size label below/beside the selection
  - [x] 6.1.10 Footer action bar: select stage and preview stage buttons
  - [x] 6.1.11 Keyboard: Enter = advance stage; Esc = close/back
  - [x] 6.1.12 On tab change, reset crop in `onImageLoad`
  - [x] 6.1.13 On aspect pill change, re-seed crop selection
  - [x] 6.1.14 On preview click (manual): compute natural-px rect, call `previewManualCrop`
  - [x] 6.1.15 On preview click (auto): call `previewAutoCrop`
  - [x] 6.1.16 On apply click: call `commitCrop`
  - [x] 6.1.17 Loading states: spinner, disabled controls while pending
  - [x] 6.1.18 Error handling: `toast.error(err.message)` via sonner
  - [x] 6.1.19 On commit success: call `onCommitted(data.newVersion)`
- [x] 6.2 Natural-pixel coordinate math with rounding
- [x] 6.3 ARIA labels on modal root

## 7. Client: gallery-panel — wire crop modal

- [x] 7.1 In `src/components/gallery-panel.tsx`:
  - [x] 7.1.1 Remove `const cropMut = trpc.export.crop.useMutation()` at line 50
  - [x] 7.1.2 Add `const [cropModalOpen, setCropModalOpen] = useState(false)` near other modal state (line ~46)
  - [x] 7.1.3 Replace the `<button onClick={() => cropMut.mutate(...)}>` at line 480 with `<button onClick={() => setCropModalOpen(true)}>크롭</button>` (no more instant mutate; no more loading text)
  - [x] 7.1.4 Delete the `{cropMut.data && <a ...>크롭 결과 다운로드</a>}` link at line 484 (crops now become versions, not download links)
  - [x] 7.1.5 Render `<CropModal sourceVersion={mVer} onClose={() => setCropModalOpen(false)} onCommitted={handleCropCommitted} />` conditionally when `cropModalOpen && modalIdx !== null`
  - [x] 7.1.6 Define `handleCropCommitted(newVersionId)`: invalidate `trpc.logo.list` (or whichever query feeds `logos`), wait for refetch, then set `activeIdx` to the new version's index within its card. Close the crop modal.
- [x] 7.2 Add version-card "✂️ 크롭" badge:
  - [x] 7.2.1 In the version-card rendering logic, if `version.metadata?.source === 'crop_manual' || version.metadata?.source === 'crop_auto'`, render a small "✂️ 크롭" pill (green-tinted) above or beside existing REV/ORIGINAL pill
  - [x] 7.2.2 Tooltip on hover: `수동 크롭` or `자동 크롭` depending on specific source value
- [x] 7.3 Hide or suppress the gallery modal's image + action-bar when `cropModalOpen` is true (content swap). Keep the outer `fixed inset-0` overlay but render `<CropModal />` inside it. Ensure Esc closes the crop modal first, not the whole gallery modal (check the existing keydown effect at lines 122–131 for Esc handling order).

## 8. Client: type definitions

- [x] 8.1 `LogoVersionMetadata` exported from `src/lib/logo-version-metadata.ts`
- [x] 8.2 CropModal uses typed `onCommitted` callback (typed return from server)

## 9. Verification — LSP + build + types

- [x] 9.1 Run `npx tsc --noEmit` (or `pnpm typecheck` if defined) — zero new errors on files we changed
- [x] 9.2 Run `pnpm build` — Next.js build passes
- [x] 9.3 Run `lsp_diagnostics` on: `src/components/crop-modal.tsx`, `src/components/gallery-panel.tsx`, `src/server/routers/export.ts`, `src/lib/chat/system-prompt.ts`, `prisma/schema.prisma` (via prisma validate), `src/lib/logo-version-metadata.ts` — all clean

## 10. Verification — manual E2E

- [ ] 10.1 Start `pnpm dev`, open a project with at least one logo
- [ ] 10.2 Open gallery modal on a version, click "크롭" → tabbed modal opens with "영역 크롭" tab active
- [ ] 10.3 Manual crop: drag a selection, switch aspect ratio, verify size label updates live, click "미리보기" → preview image appears, click "적용" → new version appears in gallery and modal auto-navigates to it; "✂️ 크롭" badge renders on the new card/version indicator
- [ ] 10.4 Verify DB: new `LogoVersion` row has `parentVersionId = source`, `metadata.source = 'crop_manual'`, `metadata.cropRect` = expected integers, `metadata.sourceVersionId` = source ID
- [ ] 10.5 Verify UsageLog row written with `type='manual_crop'`, `imageCostUsd=0`, `blobBytes > 0`
- [ ] 10.6 Auto crop tab: click tab, click "미리보기" → trimmed+padded preview appears, click "적용" → new version created with `metadata.source = 'crop_auto'`, `metadata.cropRect = null`
- [ ] 10.7 Boundary test: try to drag a 5×5 crop in manual tab → apply → server rejects with 400 "크롭 영역이 너무 작습니다"; toast appears, modal stays open
- [ ] 10.8 Out-of-bounds test: manually invoke `previewManualCrop` via browser devtools with rect exceeding source → server clamps to bounds or returns clampedRect in response (no crash)
- [ ] 10.9 Transparent PNG test: upload a PNG with transparent background, manual-crop it → committed result preserves alpha (open file in image viewer to verify)
- [ ] 10.10 Mobile (or DevTools responsive mode): verify crop drag works with touch; aspect pills clickable; no page-level zoom interference
- [ ] 10.11 Esc key: inside crop modal → closes crop modal; in gallery modal without crop open → closes gallery modal (regression check)
- [ ] 10.12 Chat: type "크롭해줘" in a project → LLM directs user to gallery crop button (no tool call; no error about missing tool)

## 11. Verification — OpenSpec delta validity

- [x] 11.1 Run `openspec validate --strict manual-area-crop` — no errors
- [x] 11.2 All delta spec files have correct `## ADDED/MODIFIED/REMOVED Requirements` headers
- [x] 11.3 Every requirement has at least one `#### Scenario:` block in WHEN/THEN form

## 12. Cleanup & Archive (post-merge)

- [ ] 12.1 Run `openspec archive manual-area-crop` after implementation is merged + verified in production
- [ ] 12.2 Move this change to `openspec/changes/archive/YYYY-MM-DD-manual-area-crop/`
- [ ] 12.3 Ensure `openspec/specs/export-pipeline/spec.md`, `openspec/specs/gallery-ui/spec.md`, `openspec/specs/version-management/spec.md`, `openspec/specs/usage-tracking/spec.md`, `openspec/specs/ai-chat-engine/spec.md` are updated with the deltas applied
