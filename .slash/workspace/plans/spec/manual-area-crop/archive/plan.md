---
created: 2026-04-24T12:00:00Z
last_updated: 2026-04-24T13:00:00Z
type: spec
change_id: manual-area-crop
status: done
trigger: "Apply the manual-area-crop spec — tabbed crop modal (auto + manual) with preview→commit flow, new LogoVersion per crop, metadata tracking, crop badge"
---

# Plan: Manual Area Crop — Tabbed Crop Modal with Preview→Commit Flow

## Background & Research

### Research Documents
- `.slash/workspace/research/spec-manual-crop-library-comparison.md` — react-image-crop v11 chosen (ISC, ~12 kB, React 19 compat, 8-handle selector, aspect locking, rule-of-thirds built-in)
- `.slash/workspace/research/spec-manual-crop-sharp-patterns.md` — sharp.extract({left,top,width,height}) with integer coords, bounds clamping, min 10px, preserve alpha on manual crop
- `.slash/workspace/research/spec-manual-crop-ux-patterns.md` — tabbed modal, aspect pills, rule-of-thirds always-on, preview→commit flow

### Current Export Router — `crop` mutation to be replaced
- File: `src/server/routers/export.ts` lines 10–57:
```ts
crop: protectedProcedure
  .input(z.object({ logoVersionId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const version = await ctx.prisma.logoVersion.findUnique({
      where: { id: input.logoVersionId },
      include: { logo: { include: { project: { select: { userId: true } } } } },
    })
    if (!version || version.logo.project.userId !== ctx.session.user.id) {
      throw new Error("Version not found")
    }
    const response = await fetch(version.imageUrl)
    const imageBuffer = Buffer.from(await response.arrayBuffer())
    const trimmed = await sharp(imageBuffer)
      .trim({ background: "#ffffff", threshold: 20 })
      .toBuffer({ resolveWithObject: true })
    const padding = Math.round(Math.max(trimmed.info.width, trimmed.info.height) * 0.06)
    const size = Math.max(trimmed.info.width, trimmed.info.height) + padding * 2
    const cropped = await sharp({
      create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).composite([{ input: trimmed.data, gravity: "center" }]).png().toBuffer()
    const key = getStorageKey(ctx.session.user.id, version.logo.projectId, version.logoId, `${version.id}-cropped`, "png")
    const { url, bytes: _bytes } = await uploadImage(key, cropped)
    return { url, key }
  }),
```

### Vectorize mutation pattern (template for new mutations)
- File: `src/server/routers/export.ts` lines 102–298
- Key patterns: `protectedProcedure`, version fetch + userId auth check, `TRPCError` codes, `getStorageKey` + `uploadImage`, `$transaction` for version update + UsageLog, `blobCost(bytes)` for cost calculation

### UsageLog creation example (from vectorize)
```ts
ctx.prisma.usageLog.create({
  data: {
    userId: ctx.session.user.id,
    projectId: version.logo.projectId,
    type: "vectorize",
    count: 1,
    imageCount: 1,
    model: "vectorize",
    imageCostUsd: RECRAFT_VECTORIZE_USD,
    blobBytes: BigInt(bytes),
    blobCostUsd: blobCost(bytes),
  },
})
```

### Gallery Panel — crop button & modal structure
- File: `src/components/gallery-panel.tsx`
- Line 50: `const cropMut = trpc.export.crop.useMutation()`
- Line 480: `<button onClick={() => cropMut.mutate({ logoVersionId: mVer.id })} ...>{cropMut.isPending ? "크롭 중..." : "크롭"}</button>`
- Line 484: `{cropMut.data && <a href={cropMut.data.url} ...>크롭 결과 다운로드</a>}`
- Lines 417–488: Full-screen modal `fixed inset-0 bg-[rgba(0,0,0,0.92)] z-50`
- Lines 120–134: Keyboard handler (Esc closes modal, ←→ logo nav, ↑↓ version cycle, F favorite)
- Line 45: `const [activeIdx, setActiveIdx] = useState<Record<string, number>>({})`
- Line 46: `const [modalIdx, setModalIdx] = useState<number | null>(null)`
- Lines 426–428: Version badge renders "REV v{N}" or "ORIGINAL" based on activeIdx
- Client type `LogoVersion` (lines 11–20) does NOT have `metadata` — must be added

### Logo Router — version queries
- File: `src/server/routers/logo.ts`
- `listByProject` (lines 7–24): uses `include: { versions: { orderBy: { versionNumber: "asc" } } }` — **no explicit select**, so `metadata` will come through automatically after migration + prisma generate
- `getWithVersions` (lines 26–40): same pattern — `include: { versions: ... }` without select
- `getVersionTree` (lines 42–66): uses **explicit select** on versions:
  ```ts
  select: {
    id: true, versionNumber: true, parentVersionId: true,
    imageUrl: true, editPrompt: true, createdAt: true,
  }
  ```
  **Must add `metadata: true`** to this select clause

### System Prompt — dead reference
- File: `src/lib/chat/system-prompt.ts` lines 60–65:
```ts
## Export Requests
When the user wants to finalize:
- "크롭해줘" → crop whitespace        // ← LINE 62, dead reference — no matching tool
- "배경 제거해줘" / "SVG로 변환해줘" → 아직 준비 중인 기능이므로...
Call the appropriate export tool.      // ← LINE 65, misleading — no crop tool exists
```

### Storage functions
- File: `src/lib/storage.ts`
```ts
export function getStorageKey(userId: string, projectId: string, logoId: string, versionId: string, ext = "png") {
  return `users/${userId}/projects/${projectId}/logos/${logoId}/${versionId}.${ext}`
}
export async function uploadImage(key: string, body: Buffer, contentType = "image/png"): Promise<{ url: string; bytes: number }> {
  const blob = await put(key, body, { access: "public", contentType })
  return { url: blob.url, bytes: body.byteLength }
}
```

### Prisma Schema — LogoVersion model (no metadata field yet)
- File: `prisma/schema.prisma` lines 84–101:
```prisma
model LogoVersion {
  id              String   @id @default(cuid())
  logoId          String
  versionNumber   Int
  parentVersionId String?
  imageUrl        String
  svgUrl          String?
  s3Key           String
  editPrompt      String?  @db.Text
  logo            Logo     @relation(fields: [logoId], references: [id], onDelete: Cascade)
  parentVersion   LogoVersion? @relation("VersionTree", fields: [parentVersionId], references: [id])
  childVersions   LogoVersion[] @relation("VersionTree")
  chatMessageId   String?
  chatMessage     ChatMessage? @relation(fields: [chatMessageId], references: [id])
  createdAt       DateTime @default(now())
  @@index([logoId])
  @@index([parentVersionId])
}
```

### UsageLog model (type is free-form String — no schema change needed)
```prisma
model UsageLog {
  id        String   @id @default(cuid())
  userId    String
  projectId String?
  type      String   // "generate" | "edit" | "llm" | "vectorize"
  count     Int      @default(1)
  model     String?
  imageCount Int?
  imageCostUsd Decimal? @db.Decimal(14,6)
  ...
  blobBytes BigInt?
  blobCostUsd Decimal? @db.Decimal(14,6)
  ...
}
```

### Router composition
- File: `src/server/routers/_app.ts`:
```ts
export const appRouter = router({
  project: projectRouter, logo: logoRouter, chat: chatRouter,
  generation: generationRouter, export: exportRouter,
  subscription: subscriptionRouter, admin: adminRouter,
  usage: usageRouter, adminInsights: adminInsightsRouter,
})
```

### Key react-image-crop usage pattern (from research)
```tsx
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"

// Natural pixel coordinate conversion:
const scaleX = img.naturalWidth / img.width
const scaleY = img.naturalHeight / img.height
const rect = {
  x: Math.round(completed.x * scaleX),
  y: Math.round(completed.y * scaleY),
  width: Math.round(completed.width * scaleX),
  height: Math.round(completed.height * scaleY),
}
```

---

## Testing Plan (TDD — tests first)

> Note: This project has no unit test framework configured. Testing is via TypeScript type-checking (`tsc --noEmit`), Next.js build (`pnpm build`), LSP diagnostics, and manual E2E verification. The "tests" below are verification checkpoints, not automated test suites.

### Type-level verification (runs after each batch)
- [ ] T1. Run `npx tsc --noEmit` — zero new errors across all changed files
- [ ] T2. Run `pnpm build` — Next.js production build passes
- [ ] T3. Run LSP diagnostics on: `prisma/schema.prisma`, `src/lib/logo-version-metadata.ts`, `src/server/routers/export.ts`, `src/server/routers/logo.ts`, `src/lib/chat/system-prompt.ts`, `src/components/crop-modal.tsx`, `src/components/gallery-panel.tsx` — all clean

### Manual E2E verification (tasks.md §10)
- [ ] T4. Start `pnpm dev`, open a project with at least one logo
- [ ] T5. Open gallery modal on a version → click "크롭" → tabbed modal opens with "영역 크롭" tab active
- [ ] T6. Manual crop: drag selection, switch aspect ratio, verify size label updates live → click "미리보기" → preview image appears → click "적용" → new version appears in gallery, modal auto-navigates to it, "✂️ 크롭" badge renders on the new card
- [ ] T7. Verify DB: new `LogoVersion` row has `parentVersionId = source`, `metadata.source = 'crop_manual'`, `metadata.cropRect` = expected integers, `metadata.sourceVersionId` = source ID
- [ ] T8. Verify `UsageLog` row: `type='manual_crop'`, `imageCostUsd=0`, `blobBytes > 0`
- [ ] T9. Auto crop tab: click tab → click "미리보기" → trimmed+padded preview → click "적용" → new version with `metadata.source = 'crop_auto'`, `metadata.cropRect = null`
- [ ] T10. Boundary: drag a tiny 5×5 crop → apply → server rejects with 400 "크롭 영역이 너무 작습니다"; toast appears, modal stays open
- [ ] T11. Out-of-bounds: manually invoke `previewManualCrop` via devtools with rect exceeding source → server clamps or rejects (no crash)
- [ ] T12. Transparent PNG: upload a PNG with transparent background → manual-crop → committed result preserves alpha (verify in image viewer)
- [ ] T13. Mobile (DevTools responsive): verify crop drag works with touch; aspect pills clickable; no page-level zoom interference
- [ ] T14. Esc key: inside crop modal → closes crop modal only; in gallery modal without crop → closes gallery modal (regression)
- [ ] T15. Chat: type "크롭해줘" in a project → LLM directs user to gallery crop button (no tool call, no error)

### OpenSpec validation (tasks.md §11)
- [ ] T16. Run `openspec validate --strict manual-area-crop` — no errors
- [ ] T17. All delta spec files have correct `## ADDED/MODIFIED/REMOVED Requirements` headers
- [ ] T18. Every requirement has at least one `#### Scenario:` block in WHEN/THEN form

---

## Implementation Plan

### Phase 1: Foundation — DB migration + dependency install + shared types
- [x] 1.1 Run `pnpm add react-image-crop@^11.0.10` to install the crop library
- [x] 1.2 Add `metadata Json?` column to `LogoVersion` model in `prisma/schema.prisma` — insert `metadata Json?` after the `editPrompt` field (before `logo` relation)
- [x] 1.3 Run `npx prisma migrate dev --name add_metadata_to_logo_version` to create migration
- [x] 1.4 Run `npx prisma generate` to regenerate the Prisma client with the new `metadata` field
- [x] 1.5 Create `src/lib/logo-version-metadata.ts` (NEW file) with:
  - Zod schema `logoVersionMetadataSchema` for `{ source: z.enum(["generate", "edit", "upload", "crop_manual", "crop_auto"]), cropRect: z.object({ x: z.number().int(), y: z.number().int(), width: z.number().int().min(10), height: z.number().int().min(10) }).optional(), sourceVersionId: z.string().optional() }`
  - Exported TypeScript type `LogoVersionMetadata` inferred from the Zod schema
  - Helper `parseMetadata(json: unknown): LogoVersionMetadata | null` that returns null for null/undefined/invalid input

### Phase 2: Server mutations — export router rewrite
- [x] 2.1 Delete the entire `crop` mutation body in `src/server/routers/export.ts` (lines 10–57)
- [x] 2.2 Add `previewAutoCrop` protected mutation:
  - Input: `z.object({ logoVersionId: z.string() })`
  - Fetch version + authorize (userId match on `version.logo.project.userId`) — reuse existing auth pattern from vectorize
  - Run existing auto-trim pipeline (`sharp(buf).trim({background:"#ffffff", threshold:20})` + square-pad with 6% white padding + `.png()`)
  - Upload preview buffer to `preview/${userId}/${crypto.randomUUID()}.png` via `uploadImage(key, buf)`
  - Return `{ previewUrl, previewKey, naturalWidth, naturalHeight }`
- [x] 2.3 Add `previewManualCrop` protected mutation:
  - Input: `z.object({ logoVersionId: z.string(), rect: z.object({ x: z.number().int().min(0), y: z.number().int().min(0), width: z.number().int().min(10), height: z.number().int().min(10) }) })`
  - Fetch version + authorize
  - Fetch source image, read `sharp(buf).metadata()` for naturalWidth/naturalHeight
  - Clamp rect to source bounds; throw `BAD_REQUEST` if resulting rect < 10×10 with message "크롭 영역이 너무 작습니다 (최소 10×10px)"
  - Run `sharp(buf).extract({ left: rect.x, top: rect.y, width: rect.width, height: rect.height }).png({ compressionLevel: 9 }).toBuffer()` — preserve alpha, no re-padding
  - Upload preview buffer to `preview/${userId}/${crypto.randomUUID()}.png`
  - Return `{ previewUrl, previewKey, clampedRect }`
- [x] 2.4 Add `commitCrop` protected mutation:
  - Input: `z.object({ sourceVersionId: z.string(), source: z.enum(["crop_auto", "crop_manual"]), rect: z.object({ x, y, width, height }).optional() })` — rect required iff `source === "crop_manual"`; use `.refine()` for this
  - Fetch source version + authorize
  - Re-run sharp pipeline (auto-trim for `crop_auto`; extract for `crop_manual` with same clamp+validate)
  - Determine next `versionNumber`: `max(versionNumber) + 1` scoped to `logoId`
  - Prisma transaction:
    - Create new `LogoVersion` with: `logoId`, `versionNumber`, `parentVersionId = sourceVersionId`, `chatMessageId = null`, `editPrompt = null`, `imageUrl = ""` (placeholder), `s3Key = ""` (placeholder), `metadata = { source, cropRect: rect ?? null, sourceVersionId }`
    - Get the new version's ID
  - Call `getStorageKey(userId, projectId, logoId, newVersionId, "png")` → upload buffer via `uploadImage`
  - Update new LogoVersion `imageUrl` and `s3Key` with real values
  - Write `UsageLog` row: `{ userId, projectId, type: source, count: 1, imageCount: 1, model: null, imageCostUsd: 0, blobBytes: BigInt(bytes), blobCostUsd: blobCost(bytes) }`
  - Return `{ newVersion: { id, versionNumber, imageUrl, metadata } }`
- [x] 2.5 Add a shared helper function `fetchVersionWithAuth(ctx, versionId)` that fetches the version with logo→project.userId and throws `NOT_FOUND` / `FORBIDDEN` TRPCErrors — DRY across all three new mutations
- [x] 2.6 Add a shared `clampAndValidateRect(rect, naturalWidth, naturalHeight)` helper that clamps + validates min 10×10 — used by both `previewManualCrop` and `commitCrop`

### Phase 3: Server — logo router + system prompt
- [x] 3.1 In `src/server/routers/logo.ts`, add `metadata: true` to the `getVersionTree` query's explicit `select` clause (line 50–57) — the other two queries (`listByProject`, `getWithVersions`) use `include: { versions: ... }` without explicit select, so `metadata` comes through automatically
- [x] 3.2 In `src/lib/chat/system-prompt.ts`:
  - Delete line 62: `- "크롭해줘" → crop whitespace`
  - Replace with: `- "크롭해줘" / "자를 수 있어?" → 어시스턴트는 크롭을 직접 실행할 수 없다. 사용자에게 갤러리 모달의 '크롭' 버튼을 안내한다.`
  - Update line 63: `- "배경 제거해줘" / "SVG로 변환해줘" → 아직 준비 중인 기능이므로, 현재는 지원하지 않는다고 안내하고 PNG만 제공한다고 답한다.` (remove "크롭" from available options wording since crop is now UI-only)
  - Delete line 65: `Call the appropriate export tool.` (misleading — no crop tool exists)

### Phase 4: Client — CropModal component
- [x] 4.1 Create `src/components/crop-modal.tsx` (NEW file, `"use client"`):
  - Import `ReactCrop, { centerCrop, makeAspectCrop, type PixelCrop, type Crop }` from `react-image-crop`
  - CSS import: `import "react-image-crop/dist/ReactCrop.css"`
  - Props: `{ sourceVersion: { id: string; imageUrl: string }, onClose: () => void, onCommitted: (newVersion: { id: string; versionNumber: number; imageUrl: string }) => void }`
- [x] 4.2 State management:
  - `tab: 'auto' | 'manual'` (default `'manual'`)
  - `aspect: number | undefined` (default `1` for 1:1)
  - `crop: Crop | undefined` and `completedCrop: PixelCrop | undefined`
  - `stage: 'select' | 'preview'`
  - `previewUrl: string | undefined`
  - `imgRef = useRef<HTMLImageElement>(null)` for natural-pixel coord conversion
- [x] 4.3 Tab bar: two tabs "자동 크롭" / "영역 크롭", styled with existing dark theme colors (`bg-[#1e1e1e]`, active `border-b-2 border-[#4CAF50]`)
- [x] 4.4 Manual tab image area:
  - `ReactCrop` wrapper with `touch-action: none` CSS on container (mobile)
  - Props: `crop`, `onChange`, `onComplete`, `aspect`, `keepSelection`, `ruleOfThirds`, `minWidth={20}`, `minHeight={20}`
  - Inner `<img>` with `ref={imgRef}`, `max-w-[85vw] max-h-[55vh]`, `onLoad` handler that seeds default 80% centered crop via `centerCrop(makeAspectCrop(...))`
- [x] 4.5 Aspect pills (manual tab only): `1:1`, `4:5`, `16:9`, `자유` — render as horizontal pill group below image; active pill styled with `border-[#4CAF50]`; on click: update `aspect` state and re-seed crop selection via `centerCrop(makeAspectCrop(...))` 
- [x] 4.6 Real-time size label: compute `{naturalW} × {naturalH}px` from `completedCrop` × `(img.naturalWidth / img.width)`, render below pills
- [x] 4.7 Auto tab content: single description line "여백을 자동으로 제거하고 정사각으로 맞춥니다" + source image preview (non-interactive)
- [x] 4.8 Footer action bar:
  - Select stage: `[취소]` (left) + `[미리보기]` (right, green)
  - Preview stage: `[다시 자르기]` (left, goes back to select) + `[적용]` (right, green)
  - Loading: button shows spinner, all controls disabled while mutation pending
- [x] 4.9 tRPC mutation wiring:
  - `const previewAuto = trpc.export.previewAutoCrop.useMutation()`
  - `const previewManual = trpc.export.previewManualCrop.useMutation()`
  - `const commit = trpc.export.commitCrop.useMutation()`
  - On "미리보기" click (manual): compute natural-px rect from `completedCrop`, call `previewManual.mutate({ logoVersionId: sourceVersion.id, rect })` → on success: set `previewUrl`, transition to preview stage
  - On "미리보기" click (auto): call `previewAuto.mutate({ logoVersionId: sourceVersion.id })` → on success: set `previewUrl`, transition to preview stage
  - On "적용" click: call `commit.mutate({ sourceVersionId: sourceVersion.id, source: tab === 'auto' ? 'crop_auto' : 'crop_manual', rect: tab === 'manual' ? rect : undefined })` → on success: call `onCommitted(data.newVersion)`
- [x] 4.10 Error handling: `onError` → `toast.error(err.message)` via sonner; stay on current stage so user can retry
- [x] 4.11 Keyboard: `Enter` = advance stage (select → preview, preview → commit); `Esc` = close modal (or back to select from preview)
- [x] 4.12 ARIA: `role="dialog"`, `aria-modal="true"`, `aria-label="크롭"` on modal root; focus trap recommended but optional v1

### Phase 5: Client — gallery-panel integration
- [x] 5.1 Update `LogoVersion` client type (lines 11–20) to include `metadata?: { source?: string; cropRect?: { x: number; y: number; width: number; height: number }; sourceVersionId?: string } | null`
- [x] 5.2 Remove `const cropMut = trpc.export.crop.useMutation()` at line 50
- [x] 5.3 Add `const [cropModalOpen, setCropModalOpen] = useState(false)` near other modal state (after line 46)
- [x] 5.4 Add `import { CropModal } from "@/components/crop-modal"` at top of file
- [x] 5.5 Replace the crop button at line 480: change `<button onClick={() => cropMut.mutate(...)}>크롭</button>` to `<button onClick={() => setCropModalOpen(true)} className="px-3 py-1.5 text-xs bg-[#1e1e1e] border border-[#333] rounded-lg hover:border-[#4CAF50]">크롭</button>`
- [x] 5.6 Delete the `{cropMut.data && <a ...>크롭 결과 다운로드</a>}` link at line 484
- [x] 5.7 Render CropModal conditionally: `{cropModalOpen && modalIdx !== null && mVer && (<CropModal sourceVersion={mVer} onClose={() => setCropModalOpen(false)} onCommitted={handleCropCommitted} />)}` — place inside the modal `<div>` but visually above everything (z-60)
- [x] 5.8 Define `handleCropCommitted` callback:
  - Close crop modal (`setCropModalOpen(false)`)
  - Invalidate `utils.logo.listByProject.invalidate({ projectId })` to refetch version data
  - After refetch settles, find the new version in the updated logos array and set `activeIdx` for the relevant logo to point to the new version's index
- [x] 5.8 Define `handleCropCommitted` callback:
  - In the version badge area (lines 426–428), add a condition: if `mVer.metadata?.source === 'crop_manual' || mVer.metadata?.source === 'crop_auto'`, render an additional `<span>` with `✂️ 크롭` pill (green-tinted, `bg-[rgba(46,125,50,0.85)]`)
  - Badge tooltip on hover: `title={mVer.metadata?.source === 'crop_manual' ? '수동 크롭' : '자동 크롭'}`
- [x] 5.9 Version badge — crop badge rendering:
- [x] 5.10 Esc key handling fix: in the keyboard handler (lines 120–134), check `cropModalOpen` first — if crop modal is open, Esc closes it (via `setCropModalOpen(false)`) rather than the gallery modal. This prevents both modals closing simultaneously.
- [x] 5.11 Hide gallery modal action bar when crop modal is open: wrap the info area (lines 461–486) in `{!cropModalOpen && (...)}` so the gallery buttons don't show behind the crop modal

---

## Parallelization Plan

### Batch 1: Foundation (sequential — must complete before all others)
- [x] **Coder A**: Phase 1 tasks (1.1–1.5) → files: `package.json`, `pnpm-lock.yaml`, `prisma/schema.prisma`, `prisma/migrations/*/`, `src/generated/prisma/`, `src/lib/logo-version-metadata.ts` (NEW)

### Batch 2: Server work (parallel — after Batch 1)
- [x] **Coder B**: Phase 2 tasks (2.1–2.6) — Export router rewrite → files: `src/server/routers/export.ts`
- [ ] **Coder C**: Phase 3 tasks (3.1–3.2) — Logo router metadata + system prompt → files: `src/server/routers/logo.ts`, `src/lib/chat/system-prompt.ts`

### Batch 3: Client work (parallel — after Batch 1; Coder D depends on Batch 2 for tRPC types)
- [ ] **Coder D**: Phase 4 tasks (4.1–4.12) — New CropModal component → files: `src/components/crop-modal.tsx` (NEW)
- [x] **Coder E**: Phase 5 tasks (5.1–5.11) — Gallery panel integration → files: `src/components/gallery-panel.tsx`

> **Note on Batch 3 ordering**: Coder D and Coder E can run in parallel because they touch different files. However, Coder E imports `CropModal` from `crop-modal.tsx`, so if Coder E runs first, the import will show a type error until Coder D completes. This is acceptable — the final typecheck in Batch 4 catches any issues. Alternatively, Coder D can run slightly before Coder E if strict ordering is preferred.

### Batch 4: Verification (sequential — after all Batches)
- [ ] **Coder F**: Testing tasks T1–T3 (typecheck, build, LSP diagnostics)
- [ ] **Tester**: Testing tasks T4–T15 (manual E2E in dev environment)
- [ ] **Spec validator**: Testing tasks T16–T18 (OpenSpec validation)

### Dependencies
- Batch 1 → Batch 2, 3: DB migration must complete so Prisma types include `metadata`. `react-image-crop` must be installed before CropModal can import it. `logo-version-metadata.ts` must exist for export router to import Zod schema.
- Batch 2 → Batch 3 (soft): CropModal calls `trpc.export.previewAutoCrop` etc. — these tRPC procedures must exist for type inference. However, the file can be written first and types resolve after Batch 2 completes.
- Batch 3 internal: `gallery-panel.tsx` imports from `crop-modal.tsx`, so both files just need to exist (Coder D + E parallel is fine for different files).
- Batch 4: All implementation must be complete before verification.

### Risk Areas
- **Esc key conflict**: Gallery modal and CropModal both listen for Esc. The gallery keydown handler at lines 120–134 fires on `window` — must be guarded by `cropModalOpen` state. If Coder E misses this, both modals close simultaneously.
- **tRPC type inference**: If export router mutations are not complete when CropModal is written, TypeScript will error on `trpc.export.previewAutoCrop`. Coder D should use correct mutation names; final typecheck in Batch 4 catches mismatches.
- **`react-image-crop` CSS**: Must be imported in `crop-modal.tsx` for proper styling. If omitted, the crop UI renders without handles/grid. Easy to miss — include in task 4.1.
- **`metadata` on client type**: The `LogoVersion` client type in gallery-panel is manually defined (not from Prisma). Must be extended manually (task 5.1). If forgotten, badge rendering will have type errors.
- **Natural pixel math rounding**: `Math.round()` is required on all natural-px conversions. Both client (task 4.9) and server (task 2.6) must round. If one side uses floor and the other ceil, 1px drift is possible but not functionally harmful.
- **Preview blob orphans**: Preview uploads under `preview/` prefix have no cleanup in v1. Acceptable per design doc — flag for v2 if storage costs grow.

---

## Done Criteria
- [ ] All TypeScript checks pass (`npx tsc --noEmit` clean)
- [ ] Production build passes (`pnpm build` succeeds)
- [ ] LSP diagnostics clean on all modified/new files
- [ ] Manual E2E: manual crop produces a new LogoVersion with correct metadata and badge
- [ ] Manual E2E: auto crop through new preview→commit flow produces correct LogoVersion
- [ ] Manual E2E: boundary/error cases handled (min size rejection, transparent PNG alpha preservation)
- [ ] Manual E2E: keyboard shortcuts work correctly (Esc scope, Enter advance)
- [ ] Manual E2E: chat "크롭해줘" → LLM redirects to gallery UI
- [ ] OpenSpec tasks checked: tasks.md §1–§9 all items complete
- [ ] OpenSpec validation passes: `openspec validate --strict manual-area-crop`
