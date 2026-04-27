# Research: Upload Base Image Security for Splash v1

Date: 2026-04-24

## Summary

This document outlines 2025-era security best practices for accepting user-uploaded images in a SaaS product where images will be stored in public Vercel Blob URLs and subsequently used in an LLM vision pipeline + generative image edit pipeline. We recommend a layered validation approach: client-side extension/MIME/size checks, server-side magic-byte sniffing via sharp, pixel limit enforcement, and reprocessing before Blob storage.

## Findings

### 1. MIME Allowlist vs Extension Check vs Magic-Byte Sniffing

**Why `file.type` from browser isn't trustworthy**

The `file.type` property is derived from the `Content-Type` header set by the **client**, not from actual file content. Attackers can trivially spoof this by sending a malicious file (e.g., a PHP webshell) with `Content-Type: image/png` or by naming a file `.png` despite having non-image content. This is a well-documented attack vector — see Transloadit's security guidance on magic numbers: "Validating file uploads is crucial for API security. Relying solely on file extensions or MIME types can leave your application vulnerable to spoofing attacks."

- **Reference**: [Secure API file uploads with magic numbers - Transloadit](https://transloadit.com/devtips/secure-api-file-uploads-with-magic-numbers/)

**How to magic-byte sniff with sharp or `file-type`**

Sharp itself validates image content as part of its decoding process — calling `sharp(buffer).metadata()` will throw if the buffer does not contain a valid image. This makes sharp a **defense layer on its own**. The approach:

```javascript
const metadata = await sharp(inputBuffer).metadata();
// If this throws, the file is not a valid image
```

The `file-type` npm package (v22 as of 2025) provides signature-based detection without decoding the full image, using a buffer of the first 8192 bytes. It's ESM-only. You can combine both approaches:

1. Use `file-type` for fast blacklist/allowlist enforcement
2. Use sharp for full validation + reprocessing

- **Reference**: [file-type - npm](https://www.npmjs.com/package/file-type)
- **Reference**: [Scanning image uploads in Node.js — pompelmi](https://pompelmi.app/blog/scan-image-uploads-nodejs.html)

**Recommended server-side validation layers**

| Layer | What it checks | Failure mode |
|-------|--------------|--------------|
| Client-side | Extension, MIME type, file size | Easy to bypass; UI convenience only |
| Magic-byte sniffing | Actual file signature (JPEG: `0xFF 0xD8 0xFF`, PNG: `0x89 0x50 0x4E 0x47`, WebP: `0x57 0x45 0x42 0x50` at offset 8) | Rejects non-images |
| Sharp metadata decode | Full image parsing + dimensions | Throws on corrupt/malformed images |
| Pixel limit (`limitInputPixels`) | Decompression bomb protection | Prevents oversized images |
| Re-encode via sharp | Strips embedded metadata/EXIF, produces clean output | Removes polyglot payloads |

### 2. Size Limits & DoS Prevention

**Pre-decode pixel-bomb attacks**

A "pixel bomb" is a small file (e.g., 100KB PNG) that decompresses to a massive bitmap (e.g., 100MB) by exploiting zlib/PNG compression. This can exhaust memory or cause OOM on the server. Sharp provides protection via `limitInputPixels`:

- **Default limit**: 268402689 pixels (= 16383 x 16383)
- **Documentation**: [Sharp Constructor Options](https://sharp.pixelplumbing.com/api-constructor)

```javascript
await sharp(inputBuffer, {
  limitInputPixels: 268402689, // default: reject > 16383x16383
}).metadata();
```

- **Reference**: [sharp - Input image exceeds pixel limit](https://github.com/lovell/sharp/issues/1381)

**Using sharp's `failOn` / `limitInputPixels` options**

Sharp exposes these options in its constructor:

- `failOn`: `'warning'`, `'none'`, or `'error'` (default: `'warning'`). Use `'none'` to allow processing of warnings (e.g., corrupted metadata).
- `limitInputPixels`: `number | false`. Set to `false` to disable the limit entirely — **only if you trust the input**.
- `unlimited`: `boolean`. Disables memory limits entirely — **dangerous with untrusted input**.

For untrusted uploads, keep `limitInputPixels` at the default or set it lower (e.g., `MAX_PIXELS = 8192 * 8192` ≈ 67 megapixels for high-res logos).

- **Reference**: [sharp.pixelplumbing.com - Constructor](https://sharp.pixelplumbing.com/api-constructor)

**Rate-limiting uploads per user/project**

Vercel Blob does not provide built-in rate limiting. Implement this at the API layer:

- Use Upstash Redis or generic in-memory rate limiting (per-function instance)
- Suggested: 10 uploads/minute/user for client uploads, 5/minute for server-side uploads

### 3. Content Risk — NSFW / Copyright / PII

**Should Splash moderate uploads before accepting?**

This is a product decision with tradeoffs:

- **Pre-moderation** (scan before storing): Users see the image in their gallery, but it may be flagged/deleted later. Adds latency (~500ms per image).
- **Post-moderation** (store first, scan async): Faster uploads, but inappropriate content sits in your storage until moderated.
- **No pre-moderation + terms-of-service**: Industry norm for logo SaaS. Accept uploads without pre-screen, rely on ToS/Takedown policy.

For Splash specifically: The downstream Gemini vision pipeline has built-in safety filters, but they operate in the **generation** context, not storage. Storing NSFW/illegal content in Blob exposes you to legal/takedown risk regardless of whether it's used in generation.

**Quick note**: Most logo SaaS (Looka, Tailor Brands, Canva) accept uploads without pre-moderation. Liability is shifted via Terms of Service. However, if you're feeding uploads directly into an LLM (as Splash does), consider async moderation if your legal exposure is high.

- **Reference**: [Automated Content Moderation for Scalable Platforms - Cloudinary](https://cloudinary.com/guides/ai/automated-content-moderation)
- **Reference**: [Best NSFW Detection APIs Compared: 2026 Guide - AI Engine](https://ai-engine.net/blog/best-nsfw-detection-apis-compared)

### 4. HEIC/HEIF Handling

**Does sharp support HEIC out of the box?**

No. Sharp's prebuilt binaries do **not** include libheif. From the sharp documentation:

> "Support for patent-encumbered HEIC images using hevc compression requires the use of a globally-installed libvips compiled with support for libheif, libde265 and x265."

On Vercel's Serverless Functions, libvips is prebuilt **without** libheif support. Building from source with custom libvips is not feasible in Vercel's constrained runtime — you'd need a containerized solution.

- **Reference**: [sharp - HEIF output](https://sharp.pixelplumbing.com/api-output#heif)
- **Reference**: [libvips can load, save and convert heic images but sharp cannot - GitHub Issue #3680](https://github.com/lovell/sharp/issues/3680)

**Fallback: reject HEIC in browser OR convert with browser APIs**

Options for v1:

1. **Reject HEIC client-side**: Show a user-friendly error telling them to convert to PNG/JPEG first. Many iOS users don't know their camera defaults to HEIC.
2. **Browser-side conversion**: Use `heic2any` or a similar library on the client before upload. This adds complexity.

**Realistic policy for v1**

**Reject HEIC uploads for v1.** The current `ACCEPTED_TYPES` list includes HEIC, but this won't work on Vercel's sharp runtime. Update the client-side validation to reject `.heic` extensions and remove HEIC from Vercel Blob's `allowedContentTypes`.

- **Warning source**: [Converting HEIC/HEIF Image in Node.js with Sharp Library - DEV.to](https://dev.to/up9t/converting-heic-image-extension-in-nodejs-with-the-sharp-library-39mg)

### 5. Vercel Blob Security Notes

Vercel Blob provides platform-level security:

- **Public URLs**: Unique, hard-to-guess with `addRandomSuffix: true`
- **Headers enforced**: `Content-Security-Policy: default-src "none"`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- **Encryption**: AES-256 at rest
- **Firewall**: Vercel's platform-wide DDoS protection

However, **server-side validation is still required**. Vercel's security headers protect against MIME-sniffing exploits in browsers, but they don't validate that an "image" is actually an image.

- **Reference**: [Vercel Blob Security](https://vercel.com/docs/vercel-blob/security)
- **Reference**: [Client Uploads with Vercel Blob](https://vercel.com/docs/storage/vercel-blob/client-upload)

## Recommendations

### Recommended Validation Sequence

```typescript
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';

// Configuration
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_DIMENSION = 8192; // 8192x8192 max
const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

export async function validateAndProcessImage(
  buffer: Buffer,
  filename: string
): Promise<{ buffer: Buffer; width: number; height: number; mimeType: string }> {
  // Layer 1: Client should already validate extension + size
  // This is server-side defense in depth

  // Layer 2: Magic-byte sniffing (fast)
  const fileType = await fileTypeFromBuffer(buffer);
  if (!fileType) {
    throw new Error('Unable to determine file type. Upload a valid image.');
  }
  if (!ALLOWED_MIMES.includes(fileType.mime)) {
    throw new Error(`File type ${fileType.mime} not allowed. Allowed: JPEG, PNG, WebP, GIF.`);
  }

  // Layer 3: Sharp decode + pixel limit
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer, {
      limitInputPixels: MAX_PIXELS,
    }).metadata();
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Input image exceeds pixel limit')) {
      throw new Error('Image too large. Maximum dimensions: 8192x8192 pixels.');
    }
    throw new Error('Invalid or corrupted image file.');
  }

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not read image dimensions.');
  }

  // Layer 4: Re-encode to clean image (strip metadata, prevent polyglots)
  const processed = await sharp(buffer)
    .resize({
      width: Math.min(metadata.width, MAX_DIMENSION),
      height: Math.min(metadata.height, MAX_DIMENSION),
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toFormat('jpeg', { quality: 90 }) // Or webp for better compression
    .toBuffer();

  return {
    buffer: processed,
    width: metadata.width,
    height: metadata.height,
    mimeType: fileType.mime,
  };
}
```

### Whether to Reject HEIC for v1

**Decision: Reject HEIC for v1.** 

- Sharp on Vercel runtime does not decode HEIC
- No viable server-side conversion path on Vercel Functions
- Client-side conversion adds latency and bundle size
- v1: Accept JPEG, PNG, WebP, GIF only

Update:

- Client: Reject `.heic` extension in file picker
- Server: Remove `'image/heic'` from `allowedContentTypes`
- Remove from any `ACCEPTED_TYPES` constant

### Error Messages for Users

|Error|User Message|
|-----|------------|
|Extension rejected|"HEIC files are not supported. Please convert to JPEG or PNG before uploading."|
|MIME rejected|"Only JPEG, PNG, WebP, and GIF images are allowed."|
|File size exceeded|"File too large. Maximum size: 4MB."|
|Pixel limit exceeded|"Image exceeds 8192x8192 pixels. Please use a smaller image."|
|Corrupt/invalid|"Unable to process this image. Please try a different file."|

---

## Appendix: Current Splash State

- **Chat attachment limit**: 4MB in `resizeAndUploadImage`
- **Current ACCEPTED_TYPES**: Includes HEIC (will fail on Vercel)
- **Blob usage**: `addRandomSuffix: true`, public URLs stored in DB

---

## References

- [Sharp - Input image exceeds pixel limit (GitHub)](https://github.com/lovell/sharp/issues/1381)
- [Sharp - Constructor Options](https://sharp.pixelplumbing.com/api-constructor)
- [Sharp - HEIF output](https://sharp.pixelplumbing.com/api-output#heif)
- [Secure API file uploads with magic numbers - Transloadit](https://transloadit.com/devtips/secure-api-file-uploads-with-magic-numbers/)
- [Scanning image uploads in Node.js — pompelmi](https://pompelmi.app/blog/scan-image-uploads-nodejs.html)
- [Vercel Blob Security](https://vercel.com/docs/vercel-blob/security)
- [Client Uploads with Vercel Blob](https://vercel.com/docs/storage/vercel-blob/client-upload)
- [Automated Content Moderation - Cloudinary](https://cloudinary.com/guides/ai/automated-content-moderation)
- [libvips can load but sharp cannot - GitHub Issue #3680](https://github.com/lovell/sharp/issues/3680)
- [HEIC conversion with sharp - DEV.to](https://dev.to/up9t/converting-heic-image-extension-in-nodejs-with-the-sharp-library-39mg)