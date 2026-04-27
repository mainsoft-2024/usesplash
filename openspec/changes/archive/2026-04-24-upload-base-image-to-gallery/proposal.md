## Why

Splash currently only lets users populate a project's gallery through AI generation. Many workflows start with an image the user already has (a rough sketch, an existing logo they want to modify, a brand photo they want to base a mark on). Today they can attach images to chat messages for the LLM to see, but those attachments never land in the gallery — they can't be cited with `@`, edited with the `edit_logo` tool, or exported. Users have to generate something first, then describe their existing image in words, which is a lossy and frustrating path.

This change adds a direct "upload into gallery" flow: the user drops (or picks) one or more image files, the server resizes + stores them, and each file becomes a Logo with a single v1 LogoVersion — indistinguishable from an AI-generated logo to every downstream surface (mentions, edit, export, version stacking).

## What Changes

- **Gallery upload entry points**: New `+ 업로드` button in the gallery panel header and in the empty state; whole-panel drag-and-drop target with a "Drop here" overlay while the user is dragging files
- **New tRPC mutation**: `logo.uploadBaseImage` in `src/server/routers/logo.ts` — accepts a base64 data URL + mime type + projectId, server-side resizes to 512px longest edge WebP via `sharp`, uploads to Vercel Blob, creates a Logo (prompt = `"(업로드된 이미지)"`) + LogoVersion v1 (editPrompt = null, svgUrl = null), returns the new row ids + imageUrl
- **UsageLog type "upload"**: New enum value, does NOT increment `Subscription.dailyGenerations` quota — uploads are free
- **Server-side validation**: Magic-byte sniffing via `file-type`, sharp `limitInputPixels` guard, MIME allowlist (PNG, JPEG, WebP only), 4MB size cap
- **Optimistic skeleton card**: While the mutation is in flight, a pulsing placeholder card appears at the end of the grid (same visual treatment as the existing "generating" state). Replaced with the real card on success; removed on error
- **Sequential multi-file upload**: File picker + drag-and-drop accept up to 10 files per batch, uploaded sequentially (one after another) so server load stays predictable; partial failures don't abort the batch — succeeded files stay, failed files surface a toast
- **HEIC/HEIF removed from both surfaces**: Chat panel `ACCEPTED_TYPES` currently includes HEIC but sharp on Vercel lacks libheif and crashes server-side. This change drops HEIC from both chat attachments and gallery uploads, with a friendly error
- **Body size limit raised**: Add `experimental.serverActions.bodySizeLimit = '10mb'` to `next.config.ts` so a 4MB file (≈5.3MB base64) passes through the tRPC route
- **Empty-state copy updated**: "AI와 대화하거나 가지고 계신 이미지를 업로드하세요" with a visible upload button

## Capabilities

### Modified Capabilities
- `gallery-ui`: Add upload button + drag-and-drop + optimistic skeleton + updated empty state
- `storage`: Define the Logo/LogoVersion creation pattern for uploaded images and the blob key shape
- `usage-tracking`: Add "upload" as a valid UsageLog.type that does not consume the daily generation quota
- `attachment-storage`: Tighten MIME allowlist (drop HEIC/HEIF), add magic-byte + pixel-bomb validation, make these rules shared between chat attachments and gallery uploads

## Impact

- **Database**: No schema change. `UsageLog.type` stays a free-form String; we just start writing `"upload"` rows
- **Dependencies**: Add `file-type` (MIME magic-byte sniffing) — ~30KB
- **API**: New `logo.uploadBaseImage` tRPC mutation
- **Config**: `next.config.ts` body size limit bump
- **Shared constants**: Extract `MAX_FILE_SIZE` + `ACCEPTED_TYPES` into `src/lib/attachment-constants.ts` so chat-panel and gallery-panel stay in sync
- **UI**: `src/components/gallery-panel.tsx` gains upload button, drag overlay, optimistic skeletons; `src/components/chat-panel.tsx` drops HEIC from its picker accept attribute
- **Server utilities**: `src/lib/storage.ts` gains a `validateAndResizeUpload(dataUrl, { maxBytes })` helper that wraps the existing `resizeAndUploadImage` with the stricter validation chain
