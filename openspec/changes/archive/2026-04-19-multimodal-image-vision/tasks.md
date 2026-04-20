## 1. Dependencies & Infrastructure

- [x] 1.1 Install `sharp` package (`pnpm add sharp @types/sharp` in `web/`)
- [x] 1.2 Add `resizeAndUploadImage` function to `web/src/lib/storage.ts` — accepts base64 data URL, resizes with sharp (512px max long edge, WebP), uploads to Vercel Blob, returns Blob URL

## 2. Attachment Storage Pipeline

- [x] 2.1 Create attachment processing endpoint or inline logic in `web/src/app/api/chat/route.ts` — before persisting messages, detect file parts with base64 data URLs, call `resizeAndUploadImage`, replace data URLs with Blob URLs in parts
- [x] 2.2 Update `web/src/lib/chat/parse-messages.ts` to handle both base64 data URLs and Blob URLs in file parts (backward compatibility)

## 3. LLM Vision — Message Conversion

- [x] 3.1 In `web/src/app/api/chat/route.ts`, add logic to convert file parts in user messages to OpenRouter `image_url` content format before passing to `streamText`. Text parts go first, then image parts
- [x] 3.2 Implement 5-image-per-turn safety limit — when converting messages, count total images and keep only the 5 most recent if exceeded

## 4. view_logo Tool

- [x] 4.1 Add `view_logo` tool definition in `web/src/app/api/chat/route.ts` — schema: `{ logoOrderIndex: number, versionNumber?: number }`, fetches logo from DB, returns Blob URL + metadata. Include image as experimental_toToolResultContent `image_url` part

## 5. generate_batch Reference Images

- [x] 5.1 Add `referenceImageUrls` (optional `string[]`) to `generate_batch` tool schema in `web/src/app/api/chat/route.ts`
- [x] 5.2 Update `generateLogoImage` in `web/src/lib/gemini.ts` to accept optional reference image URLs — download images, convert to base64, include as `inlineData` in Gemini API call alongside text prompt
- [x] 5.3 Wire `generate_batch` tool execute to pass `referenceImageUrls` to `generateLogoImage`

## 6. System Prompt Update

- [x] 6.1 Update `web/src/lib/chat/system-prompt.ts` to include vision instructions: auto-analyze attached images, use `view_logo` to inspect gallery logos, respect 5-image limit, use `referenceImageUrls` in `generate_batch` when user provides reference images

## 7. Verification

- [x] 7.1 Build passes (`pnpm build` in `web/`)
- [ ] 7.2 Manual test: attach image in chat → LLM analyzes it
- [ ] 7.3 Manual test: generate with reference image → logos reflect reference style
- [ ] 7.4 Manual test: view_logo tool → LLM describes a gallery logo