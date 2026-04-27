---
created: 2026-04-24T12:00:00Z
last_updated: 2026-04-24T12:00:00Z
type: spec
change_id: upload-base-image-to-gallery
status: done
trigger: "Add gallery upload flow: user drops/picks images → server validates+resizes → Logo+LogoVersion created → gallery card appears"
---

# Plan: Upload Base Image to Gallery

## Background & Research

### Research Files
- `.slash/workspace/research/spec-upload-base-image-client-server-flow.md` — Pattern A (base64 → tRPC → server resize → Blob) chosen; body size limit fix documented
- `.slash/workspace/research/spec-upload-base-image-security.md` — sharp + file-type validation chain; HEIC rejection rationale

### OpenSpec Change Docs
- `openspec/changes/upload-base-image-to-gallery/proposal.md`
- `openspec/changes/upload-base-image-to-gallery/design.md`
- `openspec/changes/upload-base-image-to-gallery/tasks.md` (11 sections, ~90 atomic tasks)
- Spec deltas: `attachment-storage`, `gallery-ui`, `storage`, `usage-tracking`

### Existing Code Patterns

**`src/lib/storage.ts` (lines 1-69) — current upload/resize pipeline:**
```ts
import { randomUUID } from "node:crypto"
import sharp from "sharp"
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
): Promise<{ url: string; bytes: number }> {
  const blob = await put(key, body, {
    access: "public",
    contentType,
  })
  return { url: blob.url, bytes: body.byteLength }
}

export async function resizeAndUploadImage(
  dataUrl: string,
  projectId: string,
  userId: string
): Promise<{ url: string; mediaType: "image/webp"; bytes: number }> {
  if (dataUrl.startsWith("http")) {
    return { url: dataUrl, mediaType: "image/webp", bytes: 0 }
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw new Error("Invalid image data URL")
  }
  const [, , base64Data] = match
  const inputBuffer = Buffer.from(base64Data, "base64")
  const outputBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()
  const key = `users/${userId}/projects/${projectId}/attachments/${randomUUID()}.webp`
  const blob = await put(key, outputBuffer, { access: "public", contentType: "image/webp" })
  return { url: blob.url, mediaType: "image/webp", bytes: outputBuffer.byteLength }
}
```

**`src/server/routers/logo.ts` (lines 1-65) — existing logo router:**
```ts
import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc/server"

export const logoRouter = router({
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, userId: ctx.session.user.id },
      })
      if (!project) throw new Error("Project not found")
      return ctx.prisma.logo.findMany({
        where: { projectId: input.projectId },
        orderBy: { orderIndex: "asc" },
        include: { versions: { orderBy: { versionNumber: "asc" } } },
      })
    }),
  // ... getWithVersions, getVersionTree queries
})
```
- **Key pattern**: Logo router uses `ctx.prisma` (not a direct import). Follow this pattern for the new mutation.
- **Key pattern**: Logo router imports `{ router, protectedProcedure }` from `@/lib/trpc/server`.

**`src/components/gallery-panel.tsx` (lines 1-373) — key sections:**
```tsx
// Header (lines 168-173):
<div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
  <span className="text-xs text-[#666]">{logos.length}개 로고{revCount > 0 ? ` · ${revCount}개 수정본` : ""}</span>
  <button onClick={onRefresh} className="text-[#555] hover:text-white transition-colors" title="새로고침">↻</button>
</div>

// Empty state (lines 118-126):
if (!logos.length) return <div className="h-full flex items-center justify-center px-6">
  <div className="relative w-full max-w-md rounded-2xl p-[1px]">
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#2a2a2a] via-[#4CAF50]/50 to-[#2a2a2a] opacity-60 blur-sm animate-pulse" />
    <div className="relative rounded-2xl border border-[#2a2a2a] bg-[#111] px-6 py-10 text-center text-[#555]">
      <p className="mb-2 text-lg text-[#ddd]">아직 생성된 로고가 없습니다</p>
      <p className="text-sm">왼쪽 채팅에서 AI와 대화를 시작하세요</p>
    </div>
  </div>
</div>

// Generating skeleton cards (lines 182-194) — reuse this pattern for upload skeletons:
{toolActivity?.type === "generating" && (
  <div className="col-span-full mb-4">
    <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
      {Array.from({ length: toolActivity.count }, (_, i) => (
        <div key={`gen-${i}`} className="aspect-square rounded-lg bg-[#1a1a1a] animate-pulse border border-[#333]"
             style={{ animationDelay: `${i * 200}ms` }} />
      ))}
    </div>
  </div>
)}

// Grid rendering (line 176):
<div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
```
- **Props**: `{ logos, isLoading, projectId, onRefresh, toolActivity }`
- **Already imported**: `trpc`, `toast` from sonner, `useComposerStore`, `useGallerySpotlightStore`
- `trpc.useUtils()` already used as `utils`

**`src/components/chat-panel.tsx` — constants & file handling:**
```tsx
// Lines 122-123 — current constants (HEIC included, must be removed):
const MAX_FILE_SIZE = 4 * 1024 * 1024
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"]

// Lines 190-211 — handleFileSelect (uses alert(), must switch to toast):
const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(event.target.files ?? [])
  if (!files.length) return
  const validFiles: File[] = []
  files.forEach((file) => {
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 첨부할 수 있어요.")
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      alert("이미지당 최대 4MB까지 첨부할 수 있어요.")
      return
    }
    validFiles.push(file)
  })
  if (validFiles.length > 0) {
    setAttachedFiles((prev) => [...prev, ...validFiles])
  }
  event.target.value = ""
}, [ACCEPTED_TYPES, MAX_FILE_SIZE])

// Lines 515-522 — file input (accept="image/*" must change to ACCEPTED_TYPES join):
<input
  type="file"
  ref={fileInputRef}
  accept="image/*"
  multiple
  onChange={handleFileSelect}
  className="absolute w-0 h-0 overflow-hidden opacity-0"
/>
```
- **Bug to fix**: `accept="image/*"` allows HEIC. Must change to `ACCEPTED_TYPES.join(",")`.
- **Bug to fix**: `handleFileSelect` checks `file.type.startsWith("image/")` generically instead of checking against `ACCEPTED_TYPES`. Must tighten.
- **Bug to fix**: Uses `alert()` instead of `toast.error()`. `toast` from sonner is already imported.

**`next.config.ts` (lines 1-22) — no `experimental` block yet:**
```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
```

**Prisma schema — relevant models:**
```prisma
model Logo {
  id          String   @id @default(cuid())
  projectId   String
  orderIndex  Int
  prompt      String   @db.Text
  aspectRatio String   @default("1:1")
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  versions    LogoVersion[]
  createdAt   DateTime @default(now())
  @@index([projectId])
}

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

model UsageLog {
  id        String   @id @default(cuid())
  userId    String
  projectId String?
  type      String   // "generate" | "edit" | "llm" | "vectorize" — add "upload"
  count     Int      @default(1)
  model     String?
  imageCount Int?
  imageCostUsd Decimal? @db.Decimal(14,6)
  llmInputTokens Int?
  llmOutputTokens Int?
  llmCostUsd Decimal? @db.Decimal(14,6)
  blobBytes BigInt?
  blobCostUsd Decimal? @db.Decimal(14,6)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
  @@index([userId, type])
}
```
- **No schema change needed.** `UsageLog.type` is a free-form String; just write `"upload"`.

**tRPC structure:**
```ts
// src/lib/trpc/server.ts — protectedProcedure:
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { session: { ...ctx.session, user: ctx.session.user } },
  });
});

// src/server/routers/_app.ts — root router:
export const appRouter = createTRPCRouter({
  project: projectRouter,
  logo: logoRouter,
  generation: generationRouter,
  export: exportRouter,
  chat: chatRouter,
  subscription: subscriptionRouter,
  usage: usageRouter,
  admin: adminRouter,
  adminInsights: adminInsightsRouter,
});
```

**Test setup:**
- Framework: **Vitest** (`vitest run` via `pnpm test:unit`)
- No `vitest.config.ts` — configured via package.json
- Testing libs: `@testing-library/react`, `jsdom`
- Existing test files pattern: `*.test.ts` / `*.test.tsx` co-located
- Existing test files in project:
  - `src/lib/pricing.test.ts`, `src/lib/gemini.test.ts`
  - `src/lib/chat/system-prompt.test.ts`, `src/lib/chat/mention-types.test.ts`, `src/lib/chat/composer-store.test.ts`
  - `src/server/routers/admin.test.ts`, `src/server/routers/admin-insights.test.ts`
  - `src/components/gallery-panel.mention.test.tsx`, `src/components/chat-panel.mention.test.tsx`
  - `src/app/api/chat/route.test.ts`, `src/app/api/chat/mention-pipeline.test.ts`

**Sonner Toaster**: Already mounted at `<Toaster position="top-center" />` in `src/app/providers.tsx`.

**`src/lib/attachment-constants.ts`**: Does NOT exist yet — must be created.

### Key Constraints
1. **Zero DB schema change** — Logo, LogoVersion, UsageLog models unchanged
2. **file-type** is ESM-only — vitest handles this natively
3. **sharp on Vercel lacks libheif** — HEIC/HEIF must be rejected everywhere
4. **Body size limit is global** — `experimental.serverActions.bodySizeLimit` applies to ALL routes
5. **`withoutEnlargement: false`** per tasks.md 2.3.5 — uploaded images smaller than 512px WILL be enlarged (differs from existing `resizeAndUploadImage` which uses `true`)

---

## Testing Plan (TDD — tests first where practical)

### Server-side tests (`src/lib/storage.test.ts` — NEW)
_Maps to tasks.md §8.1_

- [x] T1. Create `src/lib/storage.test.ts` with vitest boilerplate; mock `@vercel/blob` `put` function
- [x] T2. Test: `validateAndResizeUpload` accepts a valid 200x200 PNG data URL and returns a WebP buffer (§8.1.1)
- [x] T3. Test: `validateAndResizeUpload` accepts valid JPEG data URL (§8.1.2)
- [x] T4. Test: `validateAndResizeUpload` accepts valid WebP data URL (§8.1.2)
- [x] T5. Test: `validateAndResizeUpload` rejects HEIC data URL with Korean MIME error message (§8.1.3)
- [x] T6. Test: `validateAndResizeUpload` rejects oversize file (>4MB decoded) with "최대 4MB" error (§8.1.4)
- [x] T7. Test: `validateAndResizeUpload` rejects corrupt buffer (random bytes) with sharp decode error (§8.1.5)
- [x] T8. Test: `validateAndResizeUpload` rejects pixel bomb (exceeds `limitInputPixels`) (§8.1.6)
- [x] T9. Test: `validateAndResizeUpload` preserves aspect ratio — 320x640 input → longest edge ≤512, ratio intact (§8.1.7)
- [x] T10. Test: `validateAndResizeUpload` rejects invalid data URL format (not `data:image/...;base64,...`)

### Integration tests for mutation (`src/server/routers/logo.test.ts` — NEW)
_Maps to tasks.md §8.2_

- [x] T11. Create `src/server/routers/logo.test.ts` with vitest boilerplate; mock prisma + storage
- [x] T12. Test: Happy path — `uploadBaseImage` creates Logo with `prompt="(업로드된 이미지)"`, `aspectRatio="1:1"` + LogoVersion v1 with `editPrompt=null`, `versionNumber=1` (§8.2.1)
- [x] T13. Test: Creates UsageLog with `type="upload"`, `count=1`, `blobBytes` set (§8.2.2)
- [x] T14. Test: Does NOT increment `Subscription.dailyGenerations` (§8.2.3)
- [x] T15. Test: Rejects when `projectId` is owned by a different user → `NOT_FOUND` (§8.2.4)
- [x] T16. Test: Rejects unsupported MIME with BAD_REQUEST + Korean message (§8.2.5)
- [x] T17. Test: `orderIndex` follows existing logos — `nextIndex = last + 1` (§8.2.6)

### Client component tests (`src/components/gallery-panel.upload.test.tsx` — NEW)
_Maps to tasks.md §9.1 + §9.2_

- [x] T18. Create `src/components/gallery-panel.upload.test.tsx` with vitest + @testing-library/react boilerplate; mock tRPC
- [x] T19. Test: Clicking upload button triggers the hidden file input (§9.1.1)
- [x] T20. Test: Selecting a valid PNG shows an optimistic skeleton card immediately (§9.1.2)
- [x] T21. Test: On mutation success, skeleton is replaced via query invalidation (§9.1.3)
- [x] T22. Test: On mutation error, skeleton flips to error state + toast fires (§9.1.4)
- [x] T23. Test: Files >10 trigger batch-cap warning toast, only first 10 proceed (§9.1.5)
- [x] T24. Test: Oversize file rejected client-side with toast, does not reach mutation (§9.1.6)
- [x] T25. Test: HEIC file rejected client-side with friendly toast (§9.1.7)
- [x] T26. Test: `dragenter` on gallery container shows overlay (§9.2.1)
- [x] T27. Test: `dragleave` hides overlay with counter logic (§9.2.2)
- [x] T28. Test: `drop` triggers `handleFiles` with dropped files (§9.2.3)
- [x] T29. Test: Non-image files in drop are filtered out (§9.2.4)

---

## Implementation Plan

### Phase 0: Foundation (constants + dependency + config)
_Maps to tasks.md §1_

- [x] I1. Run `pnpm add file-type` to install file-type dependency (§1.2)
- [x] I2. Create `src/lib/attachment-constants.ts` exporting `MAX_FILE_SIZE = 4 * 1024 * 1024`, `ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]` (no HEIC), `ACCEPTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"]`, `MAX_FILES_PER_BATCH = 10` (§1.1)
- [x] I3. Update `next.config.ts`: add `experimental: { serverActions: { bodySizeLimit: '10mb' } }` to `nextConfig` object (§1.3)
- [x] I4. Verify typecheck passes: `pnpm build` or `npx tsc --noEmit` (§1.4)

### Phase 1: Server-side validation + resize helper
_Maps to tasks.md §2_

- [x] I5. In `src/lib/storage.ts`, add `validateAndResizeUpload(dataUrl: string, opts?: { maxBytes?: number }): Promise<{ buffer: Buffer; mimeType: "image/webp" }>` (§2.1, §2.2)
- [x] I6. Implement validation chain inside `validateAndResizeUpload` (§2.3):
  - [x] I6a. Parse data URL — reject if not `data:image/...;base64,...` (§2.3.1)
  - [x] I6b. Decode base64 → Buffer; reject if `buffer.byteLength > maxBytes` (default `MAX_FILE_SIZE`) (§2.3.2)
  - [x] I6c. `fileTypeFromBuffer(buffer)` — reject if `detected.mime` not in `ACCEPTED_TYPES` (§2.3.3)
  - [x] I6d. `sharp(buffer, { limitInputPixels: 268_435_456, failOn: "truncated" }).metadata()` — reject if sharp throws or `metadata.format` not in `["png", "jpeg", "webp"]` (§2.3.4)
  - [x] I6e. Resize: `sharp(...).resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: false }).webp({ quality: 85 }).toBuffer()` (§2.3.5)
  - [x] I6f. Return `{ buffer, mimeType: "image/webp" }` (§2.3.6)
- [x] I7. Each rejection throws `TRPCError({ code: "BAD_REQUEST", message })` with Korean messages (§2.4):
  - Invalid data URL: `"올바른 이미지 형식이 아니에요."`
  - Over size: `"이미지당 최대 4MB까지 업로드할 수 있어요."`
  - Unsupported MIME: `"PNG, JPEG, WebP 형식만 지원해요. (아이폰 사진은 변환이 필요합니다)"`
  - Sharp decode failure: `"이미지를 읽을 수 없어요. 파일이 손상되었을 수 있어요."`
  - Pixel bomb: `"이미지 크기가 너무 커요."`

### Phase 2: tRPC mutation
_Maps to tasks.md §3_

- [x] I8. In `src/server/routers/logo.ts`, add `uploadBaseImage` mutation: `protectedProcedure.input(z.object({ projectId: z.string(), mimeType: z.string(), dataUrl: z.string() })).mutation(...)` (§3.1)
- [x] I9. Verify project ownership: `ctx.prisma.project.findFirst({ where: { id: input.projectId, userId: ctx.session.user.id } })` → throw `NOT_FOUND` if missing (§3.2)
- [x] I10. Call `validateAndResizeUpload(input.dataUrl)` (§3.3)
- [x] I11. Inside transaction: find `lastLogo` by `orderIndex desc`, compute `nextIndex`, create `Logo { projectId, orderIndex: nextIndex, prompt: "(업로드된 이미지)", aspectRatio: "1:1" }` (§3.4)
- [x] I12. Compute `s3Key = getStorageKey(userId, projectId, logo.id, "v1")` — note: `getStorageKey` uses `ext = "png"` default, but we want WebP. Either pass `ext="webp"` or use the key as-is if downstream doesn't care about extension (check existing patterns). The tasks.md specifies the key shape `users/{userId}/projects/{projectId}/logos/{logoId}/v1.webp`, so pass `"webp"` as ext. (§3.5)
- [x] I13. `uploadImage(s3Key, buffer, "image/webp")` → `{ url, bytes }` (§3.6)
- [x] I14. Create `LogoVersion { logoId, versionNumber: 1, imageUrl: url, s3Key, editPrompt: null, parentVersionId: null }` — `chatMessageId` remains null (§3.7)
- [x] I15. Write `UsageLog { userId, projectId, type: "upload", count: 1, blobBytes: BigInt(bytes) }` — NO `dailyGenerations` increment, NO subscription limit check (§3.8)
- [x] I16. Return `{ logoId: logo.id, versionId: version.id, imageUrl: url, orderIndex: logo.orderIndex }` (§3.9)
- [x] I17. Error handling: validation errors bubble as BAD_REQUEST; DB/Blob errors wrapped as INTERNAL_SERVER_ERROR with `"업로드 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요."` (§3.10)

### Phase 3: Chat-panel HEIC cleanup
_Maps to tasks.md §4_

- [x] I18. In `src/components/chat-panel.tsx`, remove local `MAX_FILE_SIZE` and `ACCEPTED_TYPES` constants (lines 122-123); add `import { MAX_FILE_SIZE, ACCEPTED_TYPES } from "@/lib/attachment-constants"` (§4.1)
- [x] I19. Update the hidden `<input type="file">` `accept` attribute from `"image/*"` to `{ACCEPTED_TYPES.join(",")}` (line 518) (§4.2)
- [x] I20. Update `handleFileSelect`: replace `file.type.startsWith("image/")` check with `ACCEPTED_TYPES.includes(file.type)` check; replace `alert()` calls with `toast.error("PNG, JPEG, WebP 형식만 지원해요.")` and `toast.error("이미지당 최대 4MB까지 첨부할 수 있어요.")` (§4.3)
- [x] I21. Verify existing chat-panel tests still pass: `pnpm test:unit -- --reporter verbose src/components/chat-panel` (§4.4)

### Phase 4: Gallery-panel upload UI
_Maps to tasks.md §5, §6, §7_

- [x] I22. In `src/components/gallery-panel.tsx`, import shared constants: `import { MAX_FILE_SIZE, ACCEPTED_TYPES, MAX_FILES_PER_BATCH } from "@/lib/attachment-constants"` (§5.1)
- [x] I23. Add `fileInputRef = useRef<HTMLInputElement>(null)` and hidden `<input type="file" multiple accept={ACCEPTED_TYPES.join(",")} />` (§5.1)
- [x] I24. Add `pendingUploads` state: `const [pendingUploads, setPendingUploads] = useState<Array<{ localId: string; status: "uploading" | "error" }>>([])` (§5.2)
- [x] I25. Add `trpc.logo.uploadBaseImage.useMutation()` hook (§5.3)
- [x] I26. Implement `handleFiles(files: File[])` handler (§5.4):
  - [x] I26a. Filter by `ACCEPTED_TYPES.includes(f.type)` + `f.size <= MAX_FILE_SIZE`; show `toast.error` for each rejection with filename (§5.4.1)
  - [x] I26b. If `files.length > MAX_FILES_PER_BATCH`, trim to 10 and `toast.warning("한 번에 최대 10개까지 업로드할 수 있어요. 처음 10개만 업로드해요.")` (§5.4.2)
  - [x] I26c. For each valid file sequentially: push `localId` into `pendingUploads`, `FileReader.readAsDataURL`, call `uploadMutation.mutateAsync({ projectId, mimeType: file.type, dataUrl })` (§5.4.3)
  - [x] I26d. On success per file: remove `localId` from `pendingUploads`, invalidate `utils.logo.listByProject.invalidate({ projectId })` + `utils.project.invalidate()` (§5.4.4)
  - [x] I26e. On error per file: flip `localId` to `status: "error"`, show `toast.error(error.message ?? "업로드에 실패했어요.")`, auto-remove after 3s via `setTimeout` (§5.4.5)
  - [x] I26f. Batch summary toast when `files.length > 1`: `toast.success(\`\${succeeded}/\${total}개 업로드 완료\`)` or error variant (§5.4.6)
- [x] I27. Add `+ 업로드` button in header between count span and refresh button, with `data-testid="gallery-upload-button"` (§5.5)
- [x] I28. Update empty state: change copy to `"AI와 대화하거나 가지고 계신 이미지를 업로드하세요"` and add upload button inside empty-state card (§5.6)
- [x] I29. Render skeleton cards for `pendingUploads` entries at the end of the grid — `uploading` = pulsing gray (reuse existing skeleton style), `error` = red-border + X icon (§5.7)

### Phase 5: Gallery-panel drag-and-drop
_Maps to tasks.md §6_

- [x] I30. Add `isDragging` state + `dragCounterRef = useRef(0)` for counter-based drag tracking (§6.1, §6.2)
- [x] I31. Add `onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop` handlers on outer gallery container div (§6.1)
- [x] I32. Overlay: when `isDragging`, render a positioned overlay with `"여기에 놓아주세요"` text and dashed border (§6.3)
- [x] I33. `onDrop`: call `handleFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/")))`, reset counter + `isDragging` (§6.4)
- [x] I34. `preventDefault()` on `dragover` and `drop` to prevent browser opening images (§6.5)
- [x] I35. Ensure drag events don't interfere with card hover states (§6.6)

### Phase 6: Empty-state polish
_Maps to tasks.md §7_

- [x] I36. Verify refreshed empty-state card looks correct with new copy + button (§7.1)
- [x] I37. Confirm cross-project composer guard works — upload goes to the gallery's project, not the active composer project (§7.2)

### Phase 7: Documentation
_Maps to tasks.md §10_

- [x] I38. Update `AGENTS.md` to mention `src/lib/attachment-constants.ts` as single source of truth for upload types/sizes (§10.1)
- [x] I39. Update `AGENTS.md` "Known Issues / Gotchas" to note HEIC is not supported on Vercel runtime (§10.2)

---

## Parallelization Plan

### Batch 0: Foundation (single agent)
- [x] **Coder A**: I1, I2, I3, I4
  - Files (write): `src/lib/attachment-constants.ts` (NEW), `next.config.ts`, `package.json` (via pnpm add)
  - Verify: `npx tsc --noEmit` passes

### Batch 1: Server-side (parallel, after Batch 0)
- [x] **Coder B**: T1-T10, I5-I7
  - Files (write): `src/lib/storage.ts`, `src/lib/storage.test.ts` (NEW)
  - Reads: `src/lib/attachment-constants.ts`
  - Verify: `pnpm test:unit -- src/lib/storage.test.ts` all pass
- [x] **Coder C**: I18-I21
  - Files (write): `src/components/chat-panel.tsx`
  - Reads: `src/lib/attachment-constants.ts`
  - Verify: `pnpm test:unit -- src/components/chat-panel` all pass

### Batch 2: tRPC mutation (single agent, after Batch 1)
- [x] **Coder D**: T11-T17, I8-I17
  - Files (write): `src/server/routers/logo.ts`, `src/server/routers/logo.test.ts` (NEW)
  - Reads: `src/lib/storage.ts`, `src/lib/attachment-constants.ts`
  - Verify: `pnpm test:unit -- src/server/routers/logo.test.ts` all pass

### Batch 3: Gallery UI (single agent, after Batch 2)
- [x] **Coder E**: T18-T29, I22-I37
  - Files (write): `src/components/gallery-panel.tsx`, `src/components/gallery-panel.upload.test.tsx` (NEW)
  - Reads: `src/lib/attachment-constants.ts`, `src/server/routers/logo.ts` (for tRPC type inference)
  - Verify: `pnpm test:unit -- src/components/gallery-panel` all pass

### Batch 4: Docs (single agent, after Batch 3)
- [x] **Coder F**: I38-I39
  - Files (write): `AGENTS.md`

### Dependencies
- Batch 0 → Batch 1: Coder B/C need `attachment-constants.ts` to exist and `file-type` installed
- Batch 1 → Batch 2: Coder D needs `validateAndResizeUpload` in `storage.ts` to be implemented
- Batch 2 → Batch 3: Coder E needs `logo.uploadBaseImage` mutation to exist for tRPC hook typing
- Batch 3 → Batch 4: Docs should reflect final implementation

### Risk Areas
- **Coder B + Coder C are safe to parallel**: B touches `storage.ts` + `storage.test.ts`, C touches only `chat-panel.tsx`. No file overlap.
- **`file-type` is ESM-only**: May need `"type": "module"` or vitest's native ESM handling. If tests fail with ESM import errors, add `deps.inline: ['file-type']` to vitest config or use dynamic `import()` in storage.ts.
- **`ctx.prisma` availability**: Logo router uses `ctx.prisma` but `createTRPCContext` in server.ts doesn't show prisma in context. There may be middleware or a different context setup. Coder D should follow existing logo.ts patterns exactly.
- **`getStorageKey` ext parameter**: Default is `"png"` — Coder D must explicitly pass `"webp"` for the upload key.
- **`withoutEnlargement: false`** in upload helper differs from `withoutEnlargement: true` in existing `resizeAndUploadImage`. This is intentional — uploads should upscale small images to 512px.

---

## Done Criteria

- [x] All unit tests pass: `pnpm test:unit` (0 failures)
- [x] TypeScript clean: `pnpm build` completes without errors (§11.9)
- [x] LSP diagnostics clean on all modified files
- [x] `src/lib/attachment-constants.ts` exists and is imported by both `chat-panel.tsx` and `gallery-panel.tsx`
- [x] `next.config.ts` has `experimental.serverActions.bodySizeLimit = '10mb'`
- [x] `file-type` is in `dependencies` in `package.json`
- [x] `validateAndResizeUpload` exists in `storage.ts` with full validation chain
- [x] `logo.uploadBaseImage` mutation exists and creates Logo + LogoVersion v1 + UsageLog
- [x] Chat-panel no longer includes HEIC in file picker or validation
- [x] Gallery-panel has `+ 업로드` button, drag-and-drop overlay, optimistic skeletons, updated empty state
- [x] AGENTS.md updated with attachment-constants reference and HEIC gotcha

### Manual Verification Checklist (tasks.md §11)
- [x] Upload a 200KB PNG → card appears within 2s, editable via chat "@" mention (§11.1)
- [x] Upload a 5MB PNG → rejected with size toast (§11.2)
- [x] Upload an iPhone HEIC → rejected with friendly toast (§11.3)
- [x] Drag 3 PNGs onto gallery → 3 skeleton cards → 3 real cards appear sequentially (§11.4)
- [x] Upload 15 PNGs at once → warning toast, first 10 upload, last 5 ignored (§11.5)
- [x] Upload while offline → error toast, pending card auto-removes (§11.6)
- [x] Cite an uploaded logo via `@` → edit_logo tool successfully produces v2 (§11.7)
- [x] Verify UsageLog rows: `type='upload'`, `dailyGenerations` unchanged (§11.8)
- [x] `pnpm build` → no TypeScript errors (§11.9)
- [x] Chat-panel still works, HEIC picker option no longer visible (§11.10)
