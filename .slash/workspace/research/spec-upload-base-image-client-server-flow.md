# Research: Image Upload — Client → Server → Vercel Blob Patterns

**Date**: 2026-04-24  
**Project**: usesplash (Next.js 15 + tRPC v11 + Vercel Blob)  
**Context**: Gallery upload button ("+ 업로드 to gallery") for user-selected images

---

## Summary

Three main patterns exist for uploading images from a Next.js 15 client to Vercel Blob storage:

1. **Pattern A — Base64 via tRPC**: Already implemented in this repo via `resizeAndUploadImage()` for chat attachments
2. **Pattern B — Direct client upload**: Uses `@vercel/blob/client` with server-issued tokens
3. **Pattern C — Multipart/form-data**: Classic approach via Next.js 15 `request.formData()`

Given the repo already caps uploads at 4MB (~5.3MB base64), uses Pattern A for chat attachments, and has `resizeAndUploadImage` wired, **Pattern A remains the best fit** for the gallery upload button — with one key fix: the body size limit must be raised to accommodate 5.3MB base64 payloads.

---

## Pattern A: Base64 Data URL → tRPC → Server Decode + Sharp + Blob Put()

### How It Works (Current Implementation)

```typescript
// src/lib/storage.ts (lines 27-61)
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
    .resize({
      width: 512,
      height: 512,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer()

  const key = `users/${userId}/projects/${projectId}/attachments/${randomUUID()}.webp`
  const blob = await put(key, outputBuffer, {
    access: "public",
    contentType: "image/webp",
  })

  return { url: blob.url, mediaType: "image/webp", bytes: outputBuffer.byteLength }
}
```

**Client sends** base64 data URL via tRPC mutation:
```typescript
// src/app/api/chat/route.ts (lines 94-115)
if (lastUserMsg?.role === "user") {
  for (const part of lastUserMsg.parts ?? []) {
    if (part.type !== "file") continue
    const filePart = part as { type: "file"; url?: string; mediaType?: string }
    if (!filePart.url?.startsWith("data:")) continue

    const { url, mediaType } = await resizeAndUploadImage(
      filePart.url,
      projectId,
      userId
    )
    filePart.url = url
    filePart.mediaType = mediaType
  }
}
```

### Pros

- Single RPC call — unified auth via tRPC middleware
- Server controls all validation + resize before Blob upload
- Uses existing `resizeAndUploadImage` function — already tested
- No extra API route needed

### Cons

- **+33% base64 overhead**: 4MB image → ~5.3MB base64 string
- **Body size limits** — this is the critical issue:

| Platform | Default Limit | Configurable? |
|----------|------------|------------|
| Next.js App Router | 1MB (see note) | Yes, global only |
| Vercel Serverless | 4.5MB | Yes, via `vercel.json` |

**Critical**: Next.js 15 App Router ignores the old `export const config = { api: { bodyParser: { sizeLimit: '5mb' } }` syntax (Pages Router only). The correct way is:

```typescript
// next.config.ts
export default {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',  // Raise globally — affects ALL route handlers
    },
  },
}
```

Source: [Next.js GitHub Discussion #68409](https://github.com/vercel/next.js/discussions/68409), [Next.js PR #88175](https://github.com/vercel/next.js/pull/88175)

- **Memory pressure**: Base64 decoded doubles memory usage (5.3MB string → ~10.6MB buffer during decode + sharp processing)

### Practical Max File Size

For a 4MB cap (image file) with +33% base64 overhead:
- **4MB image** → **~5.3MB base64** → exceeds default 4.5MB Vercel limit
- **Safe max image**: **~3MB** (= ~4MB base64) — under Vercel's 4.5MB default

With `next.config.ts: bodySizeLimit: '10mb'` and `vercel.json` raised to 10MB:
- **Practical max image**: ~**7MB** file (= ~9.3MB base64)

---

## Pattern B: Direct Client → Vercel Blob via `@vercel/blob/client` Upload()

### How It Works

```typescript
// Server: app/api/blob/upload/route.ts
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      // AUTHENTICATION IS MANDATORY — without this, anyone can upload!
      const session = await auth()
      if (!session?.user?.id) {
        throw new Error('Not authenticated')
      }

      return {
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maximumSizeInBytes: 10 * 1024 * 1024, // 10MB
        validUntil: Date.now() + 60 * 60 * 1000, // 1 hour token expiry
        addRandomSuffix: true,
      }
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      console.log('Upload completed:', blob.url)
      // Update database with blob URL here
    },
  })

  return NextResponse.json(jsonResponse)
}
```

```typescript
// Client component
import { upload } from '@vercel/blob/client'

const blob = await upload('logos/my-logo.png', fileInput, {
  access: 'public',
  handleUploadUrl: '/api/blob/upload',
  onUploadProgress: ({ percentage }) => {
    console.log(`Uploaded: ${percentage}%`)
  },
})
```

Source: [Vercel Blob Client Upload Docs](https://vercel.com/docs/storage/vercel-blob/client-upload)

### Pros

- No base64 overhead — file goes directly to Blob
- Scales to large files (up to 5TB with multipart)
- Offloads bandwidth from Next.js server
- Can use `clientPayload` to pass metadata

### Cons

- **No server-side resize before upload** — must resize AFTER in separate step
- Requires new `/api/blob/upload` endpoint
- Must handle auth manually in `onBeforeGenerateToken` (bypasses tRPC)
- Token expiry risk for large files: default 30s may be too short — need `validUntil`
- Need `onUploadCompleted` callback to update database after upload

### Key Gotcha: Authentication Required

> **Warning**: You must authenticate and authorize users in `onBeforeGenerateToken` before generating a client token. Without this check, anyone can upload files to your Blob store.

Source: [Vercel Blob Docs](https://vercel.com/docs/storage/vercel-blob/client-upload)

---

## Pattern C: Multipart/form-data API Route (Not tRPC)

### How It Works

```typescript
// app/api/gallery-upload/route.ts
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'  // Opt out of static caching
export const maxDuration = 60           // Extend timeout

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file || file.size === 0) {
    return new Response('No file provided', { status: 400 })
  }

  // Validate MIME type — DON'T trust file.type alone!
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Resize server-side before upload
  const resized = await sharp(buffer)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()

  const key = `users/${session.user.id}/gallery/${crypto.randomUUID()}.webp`
  const blob = await put(key, resized, {
    access: 'public',
    contentType: 'image/webp',
  })

  return Response.json({ url: blob.url })
}
```

```typescript
// Client component
const formData = new FormData()
formData.set('file', fileInput)

const res = await fetch('/api/gallery-upload', {
  method: 'POST',
  body: formData,
})

const { url } = await res.json()
```

Source: [Next.js File Upload Guide 2026](https://nextjslaunchpad.com/article/nextjs-file-uploads-server-actions-route-handlers-s3-presigned-urls-drag-and-drop)

### Pros

- No base64 overhead
- Server controls validation + resize before Blob
- Uses Next.js 15 native `request.formData()` — no extra dependencies
- Can set `maxDuration` per route (unlike Pattern A's global config)

### Cons

- **Bypasses tRPC** — must handle auth manually with NextAuth
- No automatic type validation on the request body
- Need to handle `Content-Type` manually for fetch

---

## Recommendation for This Repo

### Verdict: Stick with Pattern A (Base64 via tRPC) — With Body Size Limit Fix

Given:

- Repo already uses Pattern A for chat attachments via `resizeAndUploadImage`
- Upload cap is 4MB (~5.3MB base64)
- Already has tRPC auth + validation wired
- Has sharp + WebP resize already working

**Do this**:

1. **Fix body size limit** in `next.config.ts`:

```typescript
// next.config.ts
export default {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',  // Allows ~7.5MB base64 → ~5.6MB image
    },
  },
}
```

2. **Optional**: Raise Vercel function limit in `vercel.json`:

```json
{
  "functions": {
    "app/api/chat/route.ts": { "maxDuration": 300 },
    "app/api/trpc/[trpc]/route.ts": { "maxDuration": 300 }
  }
}
```

### Why Not Pattern B or C?

| Factor | Pattern A | Pattern B | Pattern C |
|--------|----------|----------|----------|
| Base64 overhead | +33% | None | None |
| Server resize before upload | ✅ Yes | ❌ After only | ✅ Yes |
| Uses existing tRPC auth | ✅ Yes | ❌ Manual | ❌ Manual |
| Already implemented | ✅ Yes | ❌ New route | ❌ New route |
| Code complexity | Low | Medium | Medium |
| Pattern A fix needed | — | New endpoint | New endpoint |

---

## Gotchas

### 1. Next.js 15 Body Size Limit (CRITICAL)

The old Pages Router syntax is **ignored** in App Router:

```typescript
// ❌ THIS DOES NOTHING IN NEXT.JS 15 APP ROUTER
export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
}
```

Correct way:
```typescript
// next.config.ts
export default {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',  // GLOBAL — affects ALL routes
    },
  },
}
```

Source: [Next.js GitHub Discussion #68409](https://github.com/vercel/next.js/discussions/68409), [Next.js Blog Fix](https://github.com/Merit-Systems/echo/pull/736)

Vercel's default function limit is 4.5MB — override in `vercel.json` if needed.

### 2. HEIC/HEIF Browser Support

**Browsers**: Safari 15+ and Chrome 105+ have limited HEIC support — generally **NOT** usable in `<img>` tags.

**Server (sharp)**: The prebuilt `sharp` binaries do **NOT** support HEIC (HEVC). You need a custom `libvips` build with `libheif`:

> Support for patent-encumbered HEIC images using `hevc` compression requires the use of a globally-installed libvips compiled with support for libheif, libde265 and x265.

Source: [Sharp HEIF Docs](https://sharp.pixelplumbing.com/api-output#heif), [Sharp GitHub Issue #3816](https://github.com/lovell/sharp/issues/3816)

**Workaround**: Convert on client before upload using a library like `heic2any`:
```typescript
import heic2any from 'heic2any'

const blob = await heic2any({ blob: heicFile, toType: 'image/png' })
const pngUrl = URL.createObjectURL(blob)
```

### 3. MIME Sniffing — Don't Trust `file.type`

The `File.type` property is **client-settable** and can be spoofed:

```typescript
// DON'T rely on this alone for security!
const fileType = file.type  // Can be "image/png" even for a malicious file

// DO validate the actual bytes
const bytes = await file.arrayBuffer()
const firstBytes = new Uint8Array(bytes).slice(0, 4)
// Check magic bytes: PNG = [0x89, 0x50, 0x4E, 0x47]
```

Source: [MDN File.type docs](https://developer.mozilla.org/en-US/docs/Web/API/File/type)

---

## References

| Topic | URL |
|-------|-----|
| Vercel Blob Client Upload | https://vercel.com/docs/storage/vercel-blob/client-upload |
| Vercel Blob SDK | https://www.vercel.com/docs/storage/vercel-blob/using-blob-sdk |
| Next.js 15 Body Limit Fix | https://github.com/vercel/next.js/discussions/68409 |
| Next.js bodySizeLimit Config | https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config |
| Sharp HEIC Support | https://sharp.pixelplumbing.com/api-output#heif |
| Sharp Custom libvips | https://sharp.pixelplumbing.com/install#custom-libvips |
| heic2any (client convert) | https://www.npmjs.com/package/heic2any |

---

## File Locations in This Repo

| File | Purpose |
|------|---------|
| `src/lib/storage.ts` | `resizeAndUploadImage()` — base64 decode + sharp + Blob put |
| `src/app/api/chat/route.ts` | Uses `resizeAndUploadImage` for chat attachments |
| `next.config.ts` | Add `experimental.serverActions.bodySizeLimit` here |
| `src/lib/auth.ts` | NextAuth config (used by tRPC + would need manual in Pattern B/C) |