# Design: upload-base-image-to-gallery

## Context

Splash users today cannot place an existing image directly into a project's gallery. They can only (a) ask the AI to generate logos, or (b) attach an image to a chat message so the LLM can see it as vision input. Attachments never become gallery items — they aren't citable, editable, or exportable.

Meanwhile, the entire gallery surface (mentions, edit_logo tool, crop/SVG export, version stacking, spotlight-on-chip-click) is already built around the `Logo` + `LogoVersion` abstraction. The cheapest way to give uploads every feature a generated logo has is to model them as regular Logos with a single v1 LogoVersion. "Base image" in the user's ask simply means "a logo I didn't generate" — there is no new semantic. `prompt="(업로드된 이미지)"` and `editPrompt=null` are the only data markers of origin, and we deliberately do not surface that in the UI; an image is an image.

The existing chat-attachment pipeline (`src/lib/storage.ts#resizeAndUploadImage` + the `/api/chat` route) already covers the hard parts — base64 decode → sharp resize → Vercel Blob put. Reusing it means no new storage plumbing.

## Goals / Non-Goals

**Goals**
- Upload 1–10 image files per batch, sequentially, with optimistic skeleton cards
- Whole-gallery drag-and-drop target with a dismissible "Drop here" overlay
- Strict server-side validation (magic bytes + pixel-bomb guard + MIME allowlist) shared across chat and gallery surfaces
- Zero DB schema change
- Uploads do not consume `dailyGenerations` quota but are logged to `UsageLog` as `type="upload"`

**Non-Goals**
- Setting a project-wide "base image" that implicitly seeds all future `generate_batch` calls (out of scope; users seed manually via the existing `@` cite button)
- Storing the original (un-resized) image — we only keep the 512px WebP, same as chat attachments
- Bulk actions on uploaded logos (they behave exactly like any other logo from the moment they land)
- HEIC/HEIF support (would require libheif on the serverless runtime; punt to a future feature)
- New upload-specific UI badges or borders — uploaded cards look identical to generated cards

## Decisions

### Decision: Use Pattern A (base64 → tRPC → server resize → Blob)
**What**: Client reads files via `FileReader.readAsDataURL()`, sends `{ projectId, mimeType, dataUrl }` through the existing tRPC mutation layer, server decodes, resizes, uploads.

**Why**: The chat pipeline already does this with `resizeAndUploadImage`. A 4MB file produces ~5.3MB base64 — well within a raised `bodySizeLimit` of `10mb`. Unified auth via tRPC `protectedProcedure`, server controls all validation, no client-side Blob tokens to manage.

**Alternatives considered**:
- **Pattern B (direct client→Blob with `@vercel/blob/client`)**: Overkill for 4MB cap, needs a new token-issuing endpoint, and the server can't resize before upload.
- **Pattern C (multipart/form-data API route)**: Bypasses tRPC, duplicates auth handling, and produces a parallel code path for essentially the same job.

See `.slash/workspace/research/spec-upload-base-image-client-server-flow.md` for the full comparison.

### Decision: Validation chain uses sharp first, `file-type` second
**What**: Server runs `sharp(buffer, { limitInputPixels: 268_435_456 }).metadata()` first — if the buffer isn't a valid image, sharp throws and we reject. Then `file-type` confirms the detected MIME is in the allowlist (PNG/JPEG/WebP).

**Why**: Sharp is already a dependency and already decodes the image anyway during resize. Using its metadata call as the first validator is free. `file-type` is a cheap second layer that catches polyglot files where sharp accepts the image portion but the file also contains unexpected formats. `limitInputPixels` caps pixel-bomb decompression bombs.

**Alternatives considered**:
- **Trust `file.type` from the browser**: spoofable, never acceptable for uploads.
- **Use `file-type` first, then sharp**: redundant decode work and less diagnostic info on corrupt files.

See `.slash/workspace/research/spec-upload-base-image-security.md`.

### Decision: Uploaded logos share the Logo/LogoVersion data model
**What**: Upload creates a `Logo` row (prompt=`"(업로드된 이미지)"`, `aspectRatio="1:1"`) + a single `LogoVersion` (versionNumber=1, editPrompt=null, svgUrl=null, parentVersionId=null). `s3Key` uses the same `getStorageKey(userId, projectId, logo.id, "v1")` structure.

**Why**: Every downstream surface — mentions, edit_logo, crop, SVG export, version stacking — keys off `LogoVersion.imageUrl` and knows nothing about origin. Adding a `source` discriminator would force UI/tool updates across at least six files for zero user-visible benefit.

**Edge case — aspectRatio**: We default to `"1:1"` even though the uploaded image may be rectangular. The field only exists to hint future AI generations within the same project; since uploads don't trigger generation, the value is inert. The actual image's aspect ratio is preserved in the Blob (sharp resizes by longest edge, maintaining aspect) and rendered via `object-contain` in cards.

### Decision: UsageLog.type="upload" does not consume quota
**What**: New UsageLog rows write `type="upload"`, `count=1`, and `blobBytes=<stored-webp-size>`. The subscription check (`limit !== -1 && dailyGenerations + X > limit`) lives only in `generation.ts` and is not triggered by the upload mutation.

**Why**: Users already paid for/uploaded their own image — charging their generation quota feels punitive and would discourage the primary workflow this feature unlocks. We still log the event because (a) the admin dashboard reads UsageLog for activity tracking, and (b) we want the option to rate-limit uploads later without schema changes.

### Decision: Optimistic skeleton inside the existing gallery grid
**What**: The gallery panel gains a `pendingUploads: Array<{ localId: string; status: "uploading" | "error" }>` client-side state. When the user triggers an upload batch, each file pushes a pending entry. The grid renders real logo cards + pending cards. On success, the pending entry is removed and `utils.logo.listByProject.invalidate()` fires (the server row replaces it). On error, the entry flips to `status="error"` and a toast explains why; the card auto-dismisses after 3 seconds.

**Why**: Users expect instant feedback. The existing "generating" state already trains them to see pulsing skeleton cards mean "something is coming here." Reusing that pattern is both consistent and low-cost.

**Alternatives considered**:
- **Spinner on the upload button only**: grid doesn't change during upload; users might think nothing happened.
- **Toast-only**: same discoverability issue.

### Decision: Sequential uploads, not parallel
**What**: `for (const file of files) { await uploadOne(file) }`. Each skeleton card resolves in order.

**Why**: The server resize step is CPU-bound (sharp) and the Blob put is network-bound. Parallelizing 10 uploads against one serverless function would contend for CPU and potentially trip Vercel's per-invocation limits. Sequential keeps memory predictable, lets us fail-fast per file, and still feels responsive because each file is 1–3s.

### Decision: Shared constants between chat-panel and gallery-panel
**What**: Extract `MAX_FILE_SIZE` (4MB), `ACCEPTED_TYPES` (PNG/JPEG/WebP only, no HEIC), and `MAX_FILES_PER_BATCH` (10) into `src/lib/attachment-constants.ts`. Both surfaces import from there.

**Why**: Prevents drift — today the two surfaces could diverge silently (chat-panel's HEIC bug existed for months). Single source of truth.

## Risks / Trade-offs

**Body-size limit bump**: Raising `bodySizeLimit` to `10mb` applies to *every* server action and tRPC request globally. Accepted — the app has no other endpoints that benefit from a smaller cap, and the 4MB file limit is still enforced explicitly in the upload handler.

**Sharp pixel-bomb guard**: `limitInputPixels: 268_435_456` (16k × 16k) is sharp's default. A 1000×100000px image would exceed it and get rejected. Acceptable — no legitimate logo source image is that tall.

**Drag-and-drop + file input**: Both surfaces call the same `handleFiles(files: File[])`. Drag events bubble up past cards; we `preventDefault` on `dragover` at the gallery container level only so card hovers still work (e.g. the `@` cite button).

**"Upload" UsageLog rows and daily charts**: The admin/user daily-chart currently groups by `type="generate"|"edit"`. A new `"upload"` row won't appear in those charts unless the query is updated. Acceptable for v1 — admin dashboards can be extended in a follow-up.

**HEIC rejection UX**: Safari/macOS users saving an image with right-click save often get HEIC/HEIF. Our error toast tells them to convert to PNG/JPEG. Slight friction, but better than the current silent server crash.

**Partial-batch failure**: Sequential upload of 3 files where #2 fails shows a specific toast ("3개 중 2개 업로드됐어요. file2.png는 처리에 실패했어요."). The 2 successes remain. Acceptable — atomic rollback would waste the work for a non-atomic user operation.

## Migration Plan

No data migration required (no schema change). Deploy in one step:

1. Ship `attachment-constants.ts` and update chat-panel imports (HEIC silently drops from its picker — existing attached HEIC messages still render, they just can't be newly attached).
2. Ship `next.config.ts` body-size bump.
3. Ship `logo.uploadBaseImage` mutation + server validation chain.
4. Ship gallery-panel upload button + drag overlay + optimistic state.

Users with in-flight chat sessions that had already attached a HEIC file before deploy are unaffected — their file is already in the message as a base64/Blob URL.

## Open Questions

None — all design decisions are resolved. If the upload pattern proves popular, a future change can add:
- Drag-and-drop directly into a chat message to seed a specific `edit_logo` call
- A project-level "reference images" panel distinct from the gallery
- Client-side HEIC conversion via `heic2any`
