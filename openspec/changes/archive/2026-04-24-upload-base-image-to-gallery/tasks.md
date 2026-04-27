# Tasks

## 1. Shared constants + dependencies
- [x] 1.1 Create `src/lib/attachment-constants.ts` exporting `MAX_FILE_SIZE = 4 * 1024 * 1024`, `ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]` (no HEIC/HEIF), `ACCEPTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"]`, `MAX_FILES_PER_BATCH = 10`
- [x] 1.2 Install `file-type` via `pnpm add file-type`
- [x] 1.3 Update `next.config.ts` to set `experimental.serverActions.bodySizeLimit = '10mb'` (confirm current `next.config.ts` shape first; create the `experimental` block if missing)
- [x] 1.4 Verify build/typecheck passes after constants + dependency additions

## 2. Server-side validation + resize helper
- [x] 2.1 In `src/lib/storage.ts`, add `validateAndResizeUpload(dataUrl: string, opts?: { maxBytes?: number }): Promise<{ buffer: Buffer; mimeType: "image/webp"; url: string; s3Key?: string }>` — placeholder signature; exact return depends on whether we upload inside the helper or return the buffer for caller to upload
- [x] 2.2 Decision: the helper returns `{ buffer, width, height, mimeType: "image/webp" }` (resized data only) and the caller handles uploading via `uploadImage`. Rationale: the caller knows the s3Key shape (users/{userId}/projects/{projectId}/logos/{logoId}/v1.webp) which differs from chat attachments (users/{userId}/projects/{projectId}/attachments/{uuid}.webp)
- [x] 2.3 In `validateAndResizeUpload`, implement the validation chain:
  - [x] 2.3.1 Parse the data URL (reject if not `data:image/...;base64,`)
  - [x] 2.3.2 Decode base64 → Buffer; enforce `buffer.byteLength <= maxBytes` (default `MAX_FILE_SIZE`)
  - [x] 2.3.3 `fileTypeFromBuffer(buffer)` — reject if `detected.mime` is not in `ACCEPTED_TYPES`
  - [x] 2.3.4 `sharp(buffer, { limitInputPixels: 268_435_456, failOn: "truncated" }).metadata()` — reject if sharp throws or if `metadata.format` is not png/jpeg/webp
  - [x] 2.3.5 Resize with `sharp(...).resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: false }).webp({ quality: 85 }).toBuffer()`
  - [x] 2.3.6 Return `{ buffer, mimeType: "image/webp" }` (plus optional width/height from metadata for debugging)
- [x] 2.4 Each rejection path throws a `TRPCError({ code: "BAD_REQUEST", message })` with a user-facing Korean message:
  - Invalid data URL: "올바른 이미지 형식이 아니에요."
  - Over size: "이미지당 최대 4MB까지 업로드할 수 있어요."
  - Unsupported MIME: "PNG, JPEG, WebP 형식만 지원해요. (아이폰 사진은 변환이 필요합니다)"
  - Sharp decode failure: "이미지를 읽을 수 없어요. 파일이 손상되었을 수 있어요."
  - Pixel bomb: "이미지 크기가 너무 커요."

## 3. tRPC mutation
- [x] 3.1 In `src/server/routers/logo.ts`, add `uploadBaseImage: protectedProcedure.input(z.object({ projectId: z.string(), mimeType: z.string(), dataUrl: z.string() })).mutation(...)`
- [x] 3.2 Verify project ownership: `ctx.prisma.project.findFirst({ where: { id: input.projectId, userId: ctx.session.user.id } })`, throw `NOT_FOUND` if missing
- [x] 3.3 Call `validateAndResizeUpload(input.dataUrl)` to get the resized buffer
- [x] 3.4 Inside a transaction: find `lastLogo` by `orderIndex desc`, compute `nextIndex = (lastLogo?.orderIndex ?? -1) + 1`, create `Logo { projectId, orderIndex: nextIndex, prompt: "(업로드된 이미지)", aspectRatio: "1:1" }`
- [x] 3.5 Compute `s3Key = getStorageKey(userId, projectId, logo.id, "v1")`
- [x] 3.6 `uploadImage(s3Key, buffer, "image/webp")` → `{ url, bytes }`
- [x] 3.7 Create `LogoVersion { logoId, versionNumber: 1, imageUrl, s3Key, editPrompt: null, parentVersionId: null }` — chatMessageId remains null
- [x] 3.8 Write `UsageLog { userId, projectId, type: "upload", count: 1, blobBytes: bytes }` — no `dailyGenerations` increment, no subscription limit check
- [x] 3.9 Return `{ logoId: logo.id, versionId: version.id, imageUrl, orderIndex: logo.orderIndex }`
- [x] 3.10 Handle TRPCError vs unexpected errors: validation errors bubble up as BAD_REQUEST with the Korean message; DB/Blob errors become INTERNAL_SERVER_ERROR with "업로드 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요."

## 4. Chat-panel HEIC cleanup + shared constants import
- [x] 4.1 In `src/components/chat-panel.tsx`, replace inline `MAX_FILE_SIZE` and `ACCEPTED_TYPES` constants with imports from `@/lib/attachment-constants`
- [x] 4.2 Update the hidden `<input type="file">` `accept` attribute to the new `ACCEPTED_TYPES` join (no HEIC)
- [x] 4.3 Update the `handleFileSelect` error toast copy — replace the `alert()` calls with sonner toasts: `toast.error("PNG, JPEG, WebP 형식만 지원해요.")` and `toast.error("이미지당 최대 4MB까지 첨부할 수 있어요.")`
- [x] 4.4 Verify chat-panel existing mention/attachment tests still pass

## 5. Gallery-panel upload UI
- [x] 5.1 In `src/components/gallery-panel.tsx`, import shared constants + add a `fileInputRef = useRef<HTMLInputElement>(null)` and hidden `<input type="file" multiple accept={ACCEPTED_TYPES.join(",")} />`
- [x] 5.2 Add `pendingUploads` state: `const [pendingUploads, setPendingUploads] = useState<Array<{ localId: string; status: "uploading" | "error" }>>([])`
- [x] 5.3 Add `trpc.logo.uploadBaseImage.useMutation()` hook + `utils = trpc.useUtils()`
- [x] 5.4 Add `handleFiles(files: File[])` handler:
  - [x] 5.4.1 Filter by `ACCEPTED_TYPES` + `MAX_FILE_SIZE`; show `toast.error` for each rejection with filename
  - [x] 5.4.2 If `files.length > MAX_FILES_PER_BATCH`, trim to 10 and `toast.warning("한 번에 최대 10개까지 업로드할 수 있어요. 처음 10개만 업로드해요.")`
  - [x] 5.4.3 For each valid file sequentially: push a `localId` into `pendingUploads`, `FileReader.readAsDataURL`, call `uploadMutation.mutateAsync({ projectId, mimeType: file.type, dataUrl })`
  - [x] 5.4.4 On success per file: remove the `localId` from `pendingUploads`, invalidate logos query via `utils.logo.listByProject.invalidate({ projectId })` (also `utils.project.invalidate()` to refresh dashboard thumbnails)
  - [x] 5.4.5 On error per file: flip the `localId` entry to `status: "error"`, show `toast.error(error.message ?? "업로드에 실패했어요.")` with filename, auto-remove the errored entry after 3s (setTimeout)
  - [x] 5.4.6 Batch summary toast when `files.length > 1`: after all files resolved, show `toast.success(\`\${succeeded}/\${total}개 업로드 완료\`)` or error variant
- [x] 5.5 Add `+ 업로드` button in header between the count span and the refresh button, styled consistently (text + upload icon, hover colour matches existing affordances). `data-testid="gallery-upload-button"`
- [x] 5.6 Update empty state: change copy to "AI와 대화하거나 가지고 계신 이미지를 업로드하세요" and add a prominent button inside the empty-state card that triggers the same file picker
- [x] 5.7 Render skeleton cards for `pendingUploads` entries at the end of the grid (after real logos). `status="uploading"` shows pulsing gray skeleton (reuse the existing "generating" card style, same pulse animation); `status="error"` shows a red-border variant with an X icon

## 6. Gallery-panel drag-and-drop
- [x] 6.1 Add `isDragging` state + drag event handlers (`onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop`) on the outer gallery container div
- [x] 6.2 Counter-based drag-tracking (use a ref counter to handle dragenter/dragleave firing on child elements): increment on enter, decrement on leave, `isDragging` = counter > 0
- [x] 6.3 Overlay: when `isDragging`, render a `fixed`-positioned gray overlay scoped to the gallery panel bounding box with "여기에 놓아주세요" text and a dashed border. Overlay is pointer-events:none-from-children but catches drop on itself
- [x] 6.4 `onDrop` calls `handleFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/")))`, resets counter + `isDragging`
- [x] 6.5 `preventDefault()` on `dragover` and `drop` to prevent browser from opening the image
- [x] 6.6 Ensure drag events don't interfere with card hover states (e.g. `@` cite button still clickable when not dragging)

## 7. Empty-state polish
- [x] 7.1 Verify the refreshed empty-state card still looks good with the new copy + button (existing glow border animation remains)
- [x] 7.2 Confirm cross-project composer guard language works: uploading still goes to the project the gallery is showing (not the active composer project)

## 8. Server tests
- [x] 8.1 Add unit tests for `validateAndResizeUpload` in `src/lib/storage.test.ts` (or co-located):
  - [x] 8.1.1 Accepts a valid 200×200 PNG data URL → returns WebP buffer
  - [x] 8.1.2 Accepts valid JPEG and WebP
  - [x] 8.1.3 Rejects HEIC data URL with MIME error
  - [x] 8.1.4 Rejects oversize file with "최대 4MB" error
  - [x] 8.1.5 Rejects corrupt buffer (random bytes) with sharp decode error
  - [x] 8.1.6 Rejects 20000×20000 generated image (pixel bomb guard) — use a sharp-created buffer that exceeds `limitInputPixels`
  - [x] 8.1.7 Preserves aspect ratio (320×640 input → ≤512 longest edge, ratio intact)
- [x] 8.2 Add integration test for `logo.uploadBaseImage` mutation (mock prisma + storage):
  - [x] 8.2.1 Happy path: creates Logo + LogoVersion v1 with correct fields (prompt, editPrompt=null, versionNumber=1)
  - [x] 8.2.2 Creates UsageLog with type="upload", count=1, blobBytes set
  - [x] 8.2.3 Does NOT increment Subscription.dailyGenerations
  - [x] 8.2.4 Rejects when projectId is owned by a different user (NOT_FOUND)
  - [x] 8.2.5 Rejects unsupported MIME (BAD_REQUEST with Korean message)
  - [x] 8.2.6 orderIndex follows existing logos (nextIndex = last + 1)

## 9. Client tests
- [x] 9.1 Component test `src/components/gallery-panel.upload.test.tsx`:
  - [x] 9.1.1 Clicking the upload button triggers the hidden file input
  - [x] 9.1.2 Selecting a valid PNG shows an optimistic skeleton card immediately
  - [x] 9.1.3 On mutation success, skeleton is replaced (query invalidation triggers)
  - [x] 9.1.4 On mutation error, skeleton flips to error state + toast fires
  - [x] 9.1.5 Files > 10 trigger the batch-cap warning toast and only first 10 proceed
  - [x] 9.1.6 Oversize file rejected client-side with toast, does not reach mutation
  - [x] 9.1.7 HEIC file rejected client-side with friendly toast
- [x] 9.2 Drag-and-drop test:
  - [x] 9.2.1 `dragenter` on gallery container shows overlay
  - [x] 9.2.2 `dragleave` hides overlay (counter logic)
  - [x] 9.2.3 `drop` triggers `handleFiles` with dropped files
  - [x] 9.2.4 Non-image files in drop are filtered out

## 10. Docs
- [x] 10.1 Update `AGENTS.md` to mention `src/lib/attachment-constants.ts` as the single source of truth for accepted upload types/sizes
- [x] 10.2 Update `AGENTS.md` "Known Issues / Gotchas" to note that HEIC is not supported on the Vercel runtime (sharp lacks libheif)

## 11. Manual verification
- [ ] 11.1 Upload a 200KB PNG → card appears within 2s, editable via chat "@" mention
- [ ] 11.2 Upload a 5MB PNG → rejected with size toast
- [ ] 11.3 Upload an iPhone HEIC → rejected with friendly toast
- [ ] 11.4 Drag 3 PNGs onto gallery → 3 skeleton cards → 3 real cards appear sequentially
- [ ] 11.5 Upload 15 PNGs at once → warning toast, first 10 upload, last 5 ignored
- [ ] 11.6 Upload while offline → error toast, pending card auto-removes
- [ ] 11.7 Cite an uploaded logo via `@` → edit_logo tool successfully produces v2
- [ ] 11.8 Verify UsageLog rows: `SELECT type, count FROM "UsageLog" WHERE type = 'upload'` returns rows; dashboard `dailyGenerations` unchanged
- [x] 11.9 Run `pnpm build` → no TypeScript errors
- [ ] 11.10 Verify chat-panel still works, HEIC picker option no longer visible
