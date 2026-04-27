# Manual Crop Design Doc — Server-Side Sharp Implementation

**Date:** 2026-04-24  
**Context:** Manual crop feature for user-supplied rectangle `{x, y, width, height}` in natural image pixel coordinates.

---

## 1. sharp.extract API — Signature & Behavior

### API Reference

From [sharp.pixelplumbing.com/api-resize](https://sharp.pixelplumbing.com/api-resize):

```typescript
sharp(input).extract({
  left: number,   // zero-indexed offset from left edge
  top: number,  // zero-indexed offset from top edge
  width: number,
  height: number,
}) => Sharp
```

**Parameters:**
- All values must be **integral (integer)** pixels — sharp throws `Error: Invalid parameters` for floats.
- Zero-indexed: `left: 0, top: 0` is the top-left pixel.

**Out-of-Bounds Behavior:**
- **Throws `Error: Invalid parameters`** if the region exceeds image bounds. Sharp does NOT clamp — it rejects out-of-bounds coordinates.
- If extraction results in zero dimensions (e.g., `width: 0` or `height: 0`), also throws.
- The trim operation has this note: "If the result of this operation would trim an image to nothing then no change is made" — but extract does NOT have this safeguard; validation is required.

---

## 2. Validation Strategy

### Required Validation Steps

```typescript
// 1. Fetch metadata first
const meta = await sharp(buffer).metadata();
// meta.width, meta.height are available

// 2. Client sends { x, y, width, height } in NATURAL pixel coordinates (0-indexed)
// 3. Server validation:
function validateCropRect(
  rect: { x: number; y: number; width: number; height: number },
  meta: { width: number; height: number }
): void {
  // 2a. Integer check — sharp rejects floats
  if (!Number.isInteger(rect.x) || !Number.isInteger(rect.y) ||
      !Number.isInteger(rect.width) || !Number.isInteger(rect.height)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: '정수 좌표만 지원합니다.',
    })
  }

  // 2b. Non-negative
  if (rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: '좌표와 크기는 0 이상이어야 합니다.',
    })
  }

  // 2c. Bounds check — sharp throws on overflow, so reject with clear message
  if (rect.x + rect.width > meta.width ||
      rect.y + rect.height > meta.height) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: '자르기 영역이 이미지를 벗어납니다.',
    })
  }

  // 2d. Minimum crop size — prevent 1x1 garbage
  const MIN_CROP_SIZE = 10
  if (rect.width < MIN_CROP_SIZE || rect.height < MIN_CROP_SIZE) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `최소 ${MIN_CROP_SIZE}px 이상 자르세요.`,
    })
  }
}
```

### Validation Summary

| Check | Action | Reason |
|-------|--------|--------|
| Integer coord | Reject with 400 | sharp throws on floats |
| Non-negative | Reject with 400 | Invalid geometry |
| Bounds overflow | Reject with 400 | sharp throws — clearer message |
| Minimum size | Reject with 400 | Prevent 1x1 garbage |
| Maximum ratio | Optional — cap at 10:1 | Prevent extreme aspect distortion |

---

## 3. Output Padding / Framing Decisions

**Current auto-trim behavior:**
1. `sharp.trim({ background: '#ffffff', threshold: 20 })` — finds bounding box
2. Pad to square: `Math.max(w, h) * 0.06` margin, white background
3. Composite centered

**Options for manual crop:**

| Option | Description | Recommendation |
|--------|-------------|--------------|
| (A) Extract only | Return raw extracted region | User controls framing |
| (B) Repad to square | Same 6% white padding | Matches current aesthetic |
| (C) Toggle | User chooses (A) or (B) | More complex UI |

**Recommendation: Option (B) — Always repad to square with 6% white padding**

**Reasoning:**
1. **Consistency:** Auto-trim also produces square output. User expects same format.
2. **UX simplicity:** No toggle required in UI.
3. **Transparent PNG handling:** If source has alpha, pad with white (current behavior) — see §4.
4. **Output predictability:** Users know what they'll get: square PNG.

**Note:** If we later want (A) as an option, it's a separate field `padToSquare: boolean` (default: true).

---

## 4. Transparent PNG Support

**Current auto-trim behavior:**
```typescript
.trim({ background: '#ffffff', threshold: 20 })
// Uses white background — forces RGB(3 channels)
```

**For manual crop:**

| Scenario | Behavior | Recommendation |
|----------|----------|---------------|
| Source has alpha | Padding with white (removes alpha) | ✅ Use white padding |
| Source has alpha | Preserve alpha (transparent pad) | ⚠️ Different from current |

**Recommendation: Pad with white (remove alpha) by default**

**Reasoning:**
1. **Consistency:** Matches auto-trim behavior.
2. **PredPredictability:** White backgrounds are easier to preview/use.
3. **User intent:** If user wanted transparent output, they can use the uncropped image.
4. **Edge case:** If the crop area contains transparent pixels inside the region, we'd need to decide if those are preserved. Simpler to flatten to white.

**Implementation:**
```typescript
// Pad with white (3-channel, not 4-channel)
const padding = Math.round(Math.max(cropWidth, cropHeight) * 0.06)
const size = Math.max(cropWidth, cropHeight) + padding * 2
await sharp({
  create: {
    width: size,
    height: size,
    channels: 3,  // Force RGB, no alpha
    background: { r: 255, g: 255, b: 255 },
  },
}).composite([{ input: extracted, gravity: 'center' }])
```

---

## 5. Storage Key Convention

**Current key:** `${versionId}-cropped.png` (line 52 in export.ts)

| Option | Format | Pros | Cons |
|--------|--------|------|------|
| (A) Same key | `${versionId}-cropped.png` | Simpler, less storage | User loses history of crops |
| (B) Hash-based | `${versionId}-crop-${hash}.png` | History preserved | More keys, need hash of rect |
| (C) Timestamp | `${versionId}-crop-${ timestamp }.png` | History preserved | Simple, sortable by time |

**Recommendation: Option (C) — Timestamp-based**

```typescript
const timestamp = Date.now()
const key = getStorageKey(
  userId,
  projectId,
  logoId,
  `${versionId}-crop-${timestamp}`,
  'png'
)
```

**Reasoning:**
1. **Sortable:** `_${timestamp}` sorts to most recent by default.
2. **Simple:** No need to serialize `{x,y,w,h}` to a hash string.
3. **History:** User can see all their crops.
4. **Alternative:** If we want uniqueness, we could use `${versionId}-crop-${x}-${y}-${w}-${h}.png` but that's verbose.

---

## 6. Output Format & Metadata

**Current output:** Always PNG (line 45-46 in export.ts)

| Aspect | Decision | Reasoning |
|--------|----------|------------|
| Format | PNG only | Lossless, supports transparency in general |
| Compression | `compressionLevel: 6` (default) | Good balance |
| Metadata | Strip EXIF | No need for orientation, etc. |

**Implementation:**
```typescript
.png({ compressionLevel: 6 })
```

**Note:** If we want JPEG for photos (large PNGs), we'd need to detect opaque vs transparent. For logos, PNG is fine.

---

## 7. Usage Logging & Cost

**Current behavior:**
- `vectorize` mutation writes `UsageLog` with `type: 'vectorize'` (lines 275-287)
- `crop` mutation does NOT write any UsageLog row (lines 10-57)

**Analysis:**
- `crop` is a local sharp operation — no external API cost.
- `vectorize` calls Recraft API (billable) + stores blob (cost).
- Auto-trim crop is effectively free compute.

**Decision: Do NOT add UsageLog for manual crop (matching current `crop` behavior)**

**Reasoning:**
1. No external API cost — just CPU.
2. Vercel Blob storage cost is negligible for PNGs.
3. Keep the simple pattern: crop → store → return URL.

**Note:** If we later want cost analytics, we could add a `type: 'crop'` to the `UsageLog` enum. For now, skip.

---

## 8. Code Sketch — Drop-in Replacement

```typescript
// Input schema (proposed)
input: z.object({
  logoVersionId: z.string(),
  rect: z.object({
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).optional(),
})

// Mutation body sketch
crop: protectedProcedure
  .input(z.object({
    logoVersionId: z.string(),
    rect: z.object({
      x: z.number().int(),
      y: z.number().int(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    const version = await ctx.prisma.logoVersion.findUnique({
      where: { id: input.logoVersionId },
      include: { logo: { include: { project: { select: { userId: true } } } } },
    })
    if (!version || version.logo.project.userId !== ctx.session.user.id) {
      throw new Error('Version not found')
    }

    const response = await fetch(version.imageUrl)
    const imageBuffer = Buffer.from(await response.arrayBuffer())

    // === Extract metadata for validation ===
    const meta = await sharp(imageBuffer).metadata()

    let processed: Buffer

    if (input.rect) {
      // === Manual crop path ===
      const { x, y, width, height } = input.rect

      // Validate (see §2)
      validateCropRect({ x, y, width, height }, meta)
      if (x + width > meta.width || y + height > meta.height) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '자르기 영역이 이미지를 벗어납니다.',
        })
      }

      // Extract region
      const extracted = await sharp(imageBuffer)
        .extract({ left: x, top: y, width, height })
        .png()
        .toBuffer()

      // Pad to square (6% white)
      const padding = Math.round(Math.max(width, height) * 0.06)
      const size = Math.max(width, height) + padding * 2

      processed = await sharp({
        create: {
          width: size,
          height: size,
          channels: 3, // force RGB
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([{ input: extracted, gravity: 'center' }])
        .png({ compressionLevel: 6 })
        .toBuffer()
    } else {
      // === Auto-trim path (backward compat) ===
      const trimmed = await sharp(imageBuffer)
        .trim({ background: '#ffffff', threshold: 20 })
        .toBuffer({ resolveWithObject: true })

      const padding = Math.round(
        Math.max(trimmed.info.width, trimmed.info.height) * 0.06
      )
      const size = Math.max(trimmed.info.width, trimmed.info.height) + padding * 2

      processed = await sharp({
        create: {
          width: size,
          height: size,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([{ input: trimmed.data, gravity: 'center' }])
        .png()
        .toBuffer()
    }

    // Storage key (timestamp-based)
    const timestamp = Date.now()
    const key = getStorageKey(
      ctx.session.user.id,
      version.logo.projectId,
      version.logoId,
      `${version.id}-crop-${timestamp}`,
      'png'
    )
    const { url } = await uploadImage(key, processed)
    return { url, key }
  }),
```

**Key points:**
1. **`rect: optional`** — backward compat with auto-trim.
2. **Share sizing pipeline** — both paths use 6% padding, white, square output.
3. **Validation in manual path** — integer coords, bounds check, minimum size.
4. **Timestamp key** — `${versionId}-crop-${timestamp}.png`.

---

## 9. Rate Limiting / Abuse

**Current behavior:** No rate limit on `crop` mutation.

**Analysis:**
- Manual crop is CPU-bound (sharp operations).
- Vercel limits: 10s execution (default) / 60s (maxDuration).
- Typical crop: <1 second. Not a heavy operation.

**Decision: No rate limiting required**

**Reasoning:**
1. Light operation — no external API.
2. User-driven — can't easily spam without fetching source image each time.
3. Vercel provides natural limits (function execution time).
4. If abuse emerges, we can add later (e.g., max 10 crops/minute).

---

## Summary

| Decision | Recommendation |
|----------|----------------|
| sharp.extract | Use with validation (int, bounds, min size) |
| Validation | Reject out-of-bounds with clear message |
| Output | Repad to square, 6% white, always PNG |
| Alpha | Flatten to white (preserve current behavior) |
| Storage key | Timestamp-based (`-crop-${timestamp}.png`) |
| UsageLog | Skip (matching current crop behavior) |
| Rate limit | None required |

---

## References

- Sharp docs: https://sharp.pixelplumbing.com/api-resize
- Source code: `src/server/routers/export.ts` (current crop implementation)
- Auto-trim: `trim({ background: '#ffffff', threshold: 20 })` + composite centered on white canvas.