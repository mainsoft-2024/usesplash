# Manual Crop — React Library Comparison (for usesplash)

**Stack target**: Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Vercel serverless runtime.
**Goal**: Pick a React component to render an interactive area-selector on a logo image; it must emit `{x, y, width, height}` in **natural image pixel coordinates** that we hand to sharp's `.extract()` on the server.

---

## Candidates

### 1. `react-image-crop` (DomainGroupOSS → dominictobias)
- **Latest**: `11.0.10` — published **2025-04-14** (actively maintained)
- **License**: ISC
- **Peer deps**: `react >= 16.13.1` → **compatible with React 19** (no upper bound)
- **Bundle**: ~12 kB minzipped (pure component, no canvas engine shipped)
- **TS support**: First-party types
- **SSR**: Must be rendered in a client component (`"use client"`), but importable server-side
- **API shape**: Controlled component; you own the `<img>` and wrap it:
  ```tsx
  <ReactCrop crop={crop} onChange={setCrop} onComplete={setCompletedCrop} aspect={1} keepSelection>
    <img ref={imgRef} src={url} onLoad={onImageLoad} />
  </ReactCrop>
  ```
- **Output coords**: Two modes — `%` (default) or `px` (displayed px). **You** convert to natural pixels with `(img.naturalWidth / img.width) * cropPx`. Straightforward but manual.
- **Features**:
  - Free or aspect-locked selection
  - Corner + edge handles (8 handles)
  - `keepSelection`, `minWidth`/`minHeight`, `maxWidth`/`maxHeight`
  - Rule-of-thirds grid built-in (CSS)
  - Touch support (pointer events)
  - No built-in zoom/pinch — user pans page, crop box moves in image space
- **Tailwind compat**: Ships a tiny CSS file (`react-image-crop/dist/ReactCrop.css`). Styles are scoped classes; **no conflict with Tailwind v4**. Colors/borders overridable via CSS vars and class overrides.
- **React 19 / Next 15 compat**: ✅ v11 shipped post-React 19 release; no known SSR issues when wrapped in a client component.

### 2. `react-easy-crop` (ValentinH)
- **Latest**: `5.5.7` — published **2026-03-24** (actively maintained, most recent of the five)
- **License**: MIT
- **Peer deps**: `react >= 16.4.0`, `react-dom >= 16.4.0` → **compatible with React 19**
- **Bundle**: ~15 kB minzipped
- **TS support**: First-party types
- **SSR**: Needs `"use client"`; ships a CSS file
- **API shape**:
  ```tsx
  <Cropper image={url} crop={crop} zoom={zoom} aspect={1}
    onCropChange={setCrop} onZoomChange={setZoom}
    onCropComplete={(area, areaPixels) => setAreaPixels(areaPixels)} />
  ```
- **Output coords**: `onCropComplete` gives `areaPixels` already in **natural image pixels** — no manual conversion needed. This is a big win.
- **Features**:
  - Aspect-locked (free aspect requires trick — set very large aspect or use forked variant; less natural here)
  - Zoom / pinch-zoom (built-in, mobile-friendly)
  - Rotation (optional)
  - Grid overlay toggleable
  - Cropper image is rendered internally inside a fixed container (you don't own the `<img>`)
  - Touch + mouse
- **Tailwind compat**: Styles isolated; no conflicts.
- **React 19 / Next 15 compat**: ✅
- **Trade-off**: Designed around aspect-locked UX (think Instagram / profile-pic pickers). "Free" aspect is possible but less ergonomic than `react-image-crop` for logo framing.

### 3. `react-advanced-cropper` (Norserium)
- **Latest**: `0.20.1` — published **2025-03-01** (maintained, but slower cadence)
- **License**: MIT
- **Peer deps**: `react >= 16.8.0` → **compatible with React 19**
- **Bundle**: ~40 kB minzipped (heaviest of the three)
- **TS support**: First-party types
- **API shape**: Headless + preset components (`<Cropper>`, `<FixedCropper>`, custom stencils)
- **Output coords**: `onChange` → `state.coordinates` in natural image pixels
- **Features**: Most powerful — custom stencils, backgrounds, rotations, boundary modes, postprocessors (smart background, auto-fit). Overkill for logo crop.
- **Tailwind compat**: Styles isolated; theme via CSS vars.
- **React 19 / Next 15 compat**: ✅
- **Trade-off**: Heavy bundle and deeper API than we need.

### 4. `react-cropper` (wraps Cropper.js)
- **Latest**: 2.x (Cropper.js v2 underpins; 2026 releases)
- **License**: MIT
- **Bundle**: ~60 kB minzipped (Cropper.js is imperative, heavier)
- **TS support**: First-party types
- **API shape**: Imperative (`cropperRef.current.cropper.getData()`)
- **Output coords**: `getData()` returns pixel rect in natural coords
- **Features**: Comprehensive (zoom, rotate, scale, drag modes). Powerful but old-school imperative API.
- **Trade-off**: Imperative style fights React patterns; large bundle.

### 5. Custom canvas + pointer events
- **Bundle**: 0 kB (no dependency)
- **Effort**: ~300–500 LOC for a solid handle-based selector with touch support, aspect locking, constrain-to-bounds, grid overlay, and keyboard nudging — before edge cases (devicePixelRatio, resize observer, accidental pinch-zoom on mobile).
- **Trade-off**: Significant engineering cost. Not justified when maintained libraries cover 95 % of the use case.

---

## Decision Matrix (1 = worst, 5 = best)

| Criterion              | react-image-crop | react-easy-crop | react-advanced-cropper | react-cropper | Custom |
|------------------------|:----------------:|:---------------:|:----------------------:|:-------------:|:------:|
| Maintenance            |        5         |        5        |           4            |       4       |   n/a  |
| React 19 / Next 15 compat | 5            |        5        |           5            |       5       |   5    |
| DX (React-idiomatic)   |        5         |        5        |           4            |       2       |   3    |
| Bundle size            |        5         |        4        |           2            |       2       |   5    |
| Feature fit for logo crop | 5            |        4        |           3            |       3       |   3    |
| Mobile / touch         |        4         |        5        |           5            |       4       |   2    |
| Output coords ergonomics |      3         |        5        |           4            |       4       |   3    |
| Tailwind compat        |        5         |        5        |           4            |       4       |   5    |
| **Total**              |     **37**       |      **38**     |         **31**         |     **28**    | **26** |

---

## Recommendation

### Primary: **`react-image-crop`**
- **Why**: Best match for a *free-form logo framing* UX on a modal, tiny bundle, dead-simple controlled API where *we* own the `<img>` (so we can overlay a rule-of-thirds grid our way, style for dark mode, swap between a normal view and crop view without remounting the image).
- Ships built-in 8-handle selector, aspect locking, min/max constraints, and rule-of-thirds grid out of the box.
- The one downside — output coord conversion — is a one-liner helper (`crop.x * img.naturalWidth / img.width` etc.).
- Aligns with "v1 minimal UX" from the UX research doc (aspect pills 1:1, 3:1, 4:5, Free).

### Backup: **`react-easy-crop`**
- Pick this **only if** you decide to (a) tuck the cropper inside a dedicated container where you don't want to own the `<img>`, AND (b) need pinch-zoom inside the crop surface for mobile.
- Delivers natural pixel coords via `onCropComplete` without manual math.
- Downside: its UX paradigm is "fixed aspect frame, image moves underneath" (Instagram-style). Works but feels less like a classic desktop crop tool.

### Do NOT pick
- `react-advanced-cropper` — bundle overhead not justified.
- `react-cropper` — imperative API fights the rest of our controlled-component codebase.
- Custom canvas — would add weeks of engineering for no differentiated benefit.

---

## Minimal "use client" Usage Example — `react-image-crop`

```tsx
// src/components/crop-modal.tsx
"use client"

import { useRef, useState } from "react"
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"

type Rect = { x: number; y: number; width: number; height: number }

type CropModalProps = {
  imageUrl: string
  aspect?: number | undefined // 1, 16/9, 4/5, undefined=free
  onCancel: () => void
  onApply: (rect: Rect) => void // rect is in NATURAL image pixels
}

export function CropModal({ imageUrl, aspect, onCancel, onApply }: CropModalProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completed, setCompleted] = useState<PixelCrop | undefined>()

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight, width, height } = e.currentTarget
    // Default: 80% of image, centered, at aspect if given
    const initial = aspect
      ? centerCrop(makeAspectCrop({ unit: "%", width: 80 }, aspect, width, height), width, height)
      : { unit: "%" as const, x: 10, y: 10, width: 80, height: 80 }
    setCrop(initial)
  }

  function handleApply() {
    if (!completed || !imgRef.current) return
    const img = imgRef.current
    const scaleX = img.naturalWidth / img.width
    const scaleY = img.naturalHeight / img.height
    // completed is in displayed px — convert to natural px and round to integers
    const rect: Rect = {
      x: Math.round(completed.x * scaleX),
      y: Math.round(completed.y * scaleY),
      width: Math.round(completed.width * scaleX),
      height: Math.round(completed.height * scaleY),
    }
    // Clamp to bounds (defensive; server also clamps)
    rect.x = Math.max(0, Math.min(rect.x, img.naturalWidth - 1))
    rect.y = Math.max(0, Math.min(rect.y, img.naturalHeight - 1))
    rect.width = Math.max(1, Math.min(rect.width, img.naturalWidth - rect.x))
    rect.height = Math.max(1, Math.min(rect.height, img.naturalHeight - rect.y))
    onApply(rect)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/92" role="dialog" aria-modal="true">
      <div className="flex-1 flex items-center justify-center p-6">
        <ReactCrop
          crop={crop}
          onChange={(_, percent) => setCrop(percent)}
          onComplete={(pixel) => setCompleted(pixel)}
          aspect={aspect}
          keepSelection
          ruleOfThirds
          minWidth={20}
          minHeight={20}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            onLoad={onImageLoad}
            className="max-w-[85vw] max-h-[75vh] bg-white"
          />
        </ReactCrop>
      </div>
      <div className="flex items-center justify-center gap-2 p-4 bg-[#0f0f0f] border-t border-[#222]">
        {/* aspect-ratio pills go here */}
        <button onClick={onCancel} className="px-4 py-2 text-sm bg-[#1e1e1e] rounded-lg">취소</button>
        <button onClick={handleApply} disabled={!completed} className="px-4 py-2 text-sm bg-[#4CAF50] text-black rounded-lg disabled:opacity-50">
          적용
        </button>
      </div>
    </div>
  )
}
```

**Output shape passed to `onApply`**:
```ts
{ x: 240, y: 180, width: 720, height: 720 } // integer natural-image pixels
```

This matches sharp's `extract({ left: x, top: y, width, height })` signature 1:1.

---

## Gotchas

### 1. Natural-vs-displayed coordinate math
- `react-image-crop` reports **displayed px** in `onComplete`. You MUST multiply by `naturalWidth / displayedWidth` before sending to sharp.
- The `img.onLoad` callback is the correct place to capture dimensions; `getBoundingClientRect()` after layout is a fallback.

### 2. devicePixelRatio
- Mostly not an issue because we convert to natural px (independent of dpr). However, the displayed image size depends on CSS + dpr; as long as the same `<img>` is used for measurement and display, math is consistent.

### 3. Cross-origin images
- Our source is Vercel Blob (a different subdomain than `usesplash.vercel.app`). For `react-image-crop`, you do NOT need canvas access (it uses the DOM `<img>` element directly), so `crossOrigin` is only required if you also render a canvas preview.
- If we ever add a client-side canvas preview, the Blob served with `Access-Control-Allow-Origin: *` supports `crossOrigin="anonymous"`. Add the attribute to the `<img>` to avoid tainted-canvas errors.

### 4. Integer vs float
- sharp's `extract()` requires **integers** and throws on floats. Always `Math.round` client-side AND server-side.

### 5. Out-of-bounds rectangles
- Clamp client-side to naturalWidth/Height, and **re-validate server-side** with `sharp(buffer).metadata()` → reject or clamp. (Covered in the sharp-patterns research doc.)

### 6. Min crop size
- Prevent 1×1 crops with `minWidth`/`minHeight` props (e.g. 20 displayed px). Server should also enforce a minimum (e.g. 32 × 32 natural px) and reject sub-min requests.

### 7. Initial selection
- Use `centerCrop(makeAspectCrop(...))` on image load so the user sees a sensible default frame (e.g. 80 % centered). Don't start from zero — confuses users.

### 8. Aspect ratio toggling
- Changing `aspect` at runtime (from 1 → 16/9 → undefined) needs the `crop` state reset to `undefined` or re-seeded via `centerCrop(...)`, otherwise the old box persists with wrong proportions.

### 9. Unmount during pending mutation
- If user closes the modal while the server crop is in flight, cancel/ignore the response with tRPC's mutation reset or a stale-closure check. Otherwise the download link may appear for a crop they didn't want.

### 10. Touch events on iOS Safari
- `react-image-crop` uses pointer events which work well, but a parent modal with `overflow: hidden` + pinch-zoom disabled (Safari default) is needed to avoid the page zooming instead of the crop. Add `touch-action: none` on the crop surface.

---

## Install Command (for the tasks doc later)

```bash
pnpm add react-image-crop@^11
```

No `sharp` change needed — already at `0.34.5`.

---

## References
- react-image-crop GitHub: https://github.com/DomainGroupOSS/react-image-crop
- react-image-crop npm: `react-image-crop@11.0.10` (published 2025-04-14)
- react-easy-crop GitHub: https://github.com/ValentinH/react-easy-crop
- react-easy-crop npm: `react-easy-crop@5.5.7` (published 2026-03-24)
- sharp docs: https://sharp.pixelplumbing.com/api-resize#extract
