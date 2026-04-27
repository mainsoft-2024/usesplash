# Research: Manual Crop UX Patterns for Logo SaaS
Date: 2026-04-24

## Summary

Document analyzes crop UX patterns from 7 popular tools, distills consistent UX patterns, and recommends a v1 manual crop modal for usesplash (AI logo generation SaaS). Research concludes that a merged "크롭" button opening a modal with auto-trim + manual-area tabs best maintains minimal UI while adding substantial value for non-designer users who need precise control over their AI-generated logos.

---

## 1. Pattern Analysis: How Do These Tools Handle Crop?

### Figma (crop in image fill mode)

- **Entry**: Select frame → double-click or use "Crop" option in image fill settings
- **Interface**: Draggable handles on image corners and edges to define crop area
- **Preview**: Live preview updates as user drags handles
- **Controls**: Aspect ratio lock toggle in toolbar, freeform or constrained cropping
- **Confirm**: Click outside crop area or press Enter to apply; Esc to cancel
- **Notes**: Primarily for design composition, not photography-focused

### Canva (crop button in image toolbar)

- **Entry**: Select image → click "Crop" button on top toolbar
- **Interface**: Crop frame surrounds image with corner/edge handles
- **Aspect Ratios**: Side panel offers presets: 1:1, 4:5, 9:16, 16:9, Original, Freeform
- **Drag**: Drag corners or edges to adjust; hold Shift for aspect-ratio-locked corner drag
- **Preview**: Live preview on canvas
- **Confirm**: "Done" button in side panel or click outside element
- **Auto-crop**: "Smart Crop" uses AI to suggest best crop area automatically
- **Notes**: Very approachable, guided presets streamline workflow

### Adobe Express (crop tool)

- **Entry**: Select image → click crop icon in floating toolbar
- **Interface**: Similar to Canva - handles + aspect ratio selector
- **Presets**: 1:1, 4:3, 16:9, Free, Original
- **Confirm**: Done button / click outside
- **Notes**: Clean, minimalist interface optimized for quick edits

### Photoshop (crop tool)

- **Entry**: Select crop tool (C) or choose Image → Crop
- **Interface**: 8 handles (4 corners + 4 edges) plus overlay grid
- **Grid**: Rule-of-thirds grid overlaid; toggle off via View → Show → Crop Guide
- **Aspect Ratio**: Input exact dimensions or choose from dropdown
- **Overlay**: Shows composition guidance while cropping
- **Rotate**: Includes straighten/rotate bar below image
- **Confirm**: Enter to apply; Esc to cancel
- **Notes**: Professional tool - more controls but higher complexity

### Google Photos (edit → crop)

- **Entry**: Open photo → Edit (sliders icon) → Crop tab (second tab)
- **Interface**: Crop selection with draggable corners, rotate dial below
- **Presets**: Aspect ratio pills along top: Free, 1:1, 4:3, 16:9, 3:4, 9:16, Original
- **Drag**: Drag corners; drag inside to reposition; pinch to zoom
- **Controls**: Rotation dial, 90° rotate button, Reset button
- **Confirm**: "Save" stores changes; can revert later
- **Recent (2026)**: Improved fluidity - image no longer shrinks when dragging handles; smoother animations

### iOS Photos (edit → crop)

- **Entry**: Open photo → Edit → Crop button (corner icon in bottom toolbar)
- **Interface**: Crop frame with highlighted corners
- **Presets**: Swipeable bar: Free, Square, 4:3, 16:9, 3:4, 9:16, 5:7, Wallpaper
- **Gestures**: Drag corners; pinch to zoom; two-finger expand to crop from zoom level
- **Quick Crop (iOS 17+)**: Pinch to zoom → Crop button appears in corner (auto from zoom level)
- **Lock toggle**: Aspect lock icon top-right to toggle ratio lock
- **Rotate**: 90° rotate button; straighten dial
- **Flip**: Horizontal flip button
- **Confirm**: Done to save; Cancel to discard

### Instagram (post creation crop)

- **Entry**: Select photo in post creation → tap crop icon (bottom-left, overlapping corners)
- **Interface**: Simple toggle between original aspect ratio and 1:1 square
- **Presets**: Toggles between original and 1:1; other ratios via swiping through filters
- **No handles**: Pre-set ratios only, no freeform adjustment
- **Confirm**: Automatically applies; tap to toggle
- **Notes**: Very minimal - designed for speed, not precision

---

## 2. Distilled Patterns

### Aspect Ratio Presets

Common preset set across tools:
- **1:1** (Square) - most universal
- **4:5** (Portrait) - Instagram feed
- **16:9** (Landscape) - wide format
- **3:4** (Portrait) - photography standard
- **9:16** (Tall/Story) - Stories/Reels
- **Free / Original** - constrained only by original dimensions

### Grid Overlays

- **Rule-of-thirds** is the dominant overlay (Figma, Photoshop, Canva, Google Photos)
- Often **toggleable** (View → Show → Crop Guide in Photoshop)
- Some tools offer quadrants or diagonal guides but they're rarely default
- Recommended: **Always-on rule-of-thirds** for v1 - it's universally understood

### Handles

- **Corner-only** (4 handles) is sufficient for most tools (iOS, Instagram)
- **8-handle** (corners + edges) gives more control (Canva, Photoshop, Figma)
- Desktop: 8-handle enables edge-only dragging
- Mobile: Corner-only more common due to touch imprecision
- Hybrid approach: Corner handles work on both, edges optional

### Outside-Area Dimming

- **Consistent pattern**: Dimmed/overlay outside crop area (iOS, Canva, Google Photos)
- Shows exactly what will be cropped out
- Improves clarity and reduces errors

### Keyboard Shortcuts

- **Enter** or **Cmd+Enter**: Apply crop
- **Esc**: Cancel / revert to original
- **Arrow keys**: Nudge crop position (1px, 10px with Shift)
- **R**: Rotate (Photoshop)
- **Recommendation**: Support Esc + Enter for modal confirm; arrow keys optional for v1

### Preview Behavior

- **All tools**: Live preview as user drags handles
- No "Apply" needed mid-drag - changes are visible in real-time

### Reset / Undo

- **Reset button**: Single tap to revert to original (Google Photos, iOS)
- **Undo**: Single undo level within session
- **Recommendation**: "초기화" button inside modal

### Rotation / Flip

- **Risk**: Including rotation in v1 risks scope creep
- Rotation + crop interaction has known UX bugs (Google Photos 2026 fix: image would flip when rotating near crop handles)
- **Recommendation**: **Exclude rotation for v1** - separate concern from core crop UX

---

## 3. For a Logo Generator Specifically: Aspect Ratios

### Primary Logo Use Cases

| Use Case | Aspect Ratio | Priority |
|----------|-------------|----------|
| **Square (1:1)** | 1:1 | Must have - default for logos |
| **Social Banner Wide** | 3:1 (900×300) or 16:9 | High priority - Twitter/LinkedIn headers |
| **App Icon** | 1:1 or rounded square | Medium - often auto-generated |
| **Favicon sizes** | 1:1 or 32×32, 16×16 | Low for v1 - usually generated separately |
| **Story/Tall** | 9:16 | Low - niche use case for logo stories |

### Recommended v1 Preset Set (4-5 presets)

1. **정사각형 (1:1)** - Default, most common for logo display
2. **와이드 (3:1)** - 900×300 for social banners
3. **세로 (4:5)** - Instagram portrait, optional
4. **자유 (Free)** - No constraint, full flexibility

That's 4 - adds 16:9 only if there's a 5th slot. Keep it minimal.

---

## 4. Mobile / Touch Considerations

### Minimum Handle Size

- iOS HIG recommends **44×44pt** minimum touch target
- Android recommends **48dp**
- Crop handles should be at least this size, or extend hit area
- Padding around corners increases effective touch area

### Pinch-to-Zoom Inside Crop

- iOS Photos: pinch expands to zoom level, Crop button appears to confirm as-cropped
- Useful for logo work - users may want to zoom in on detail

### Thumb-Friendly Action Bar

- Bottom action bar is optimal for mobile (thumb reach)
- Cancel → Presets → Apply should flow left-to-right
- Avoid requiring two-hand operation

### Additional Touch UX

- Drag inside crop to reposition image (not just handles)
- Double-tap to reset or zoom to fit
- Swipe on presets to cycle (iOS Photos pattern)

---

## 5. Accessibility

### Keyboard-Only Operation

- All crop operations must work without a mouse
- Tab to enter crop mode; Tab cycles through handles
- Arrow keys nudge selected handle or crop area
- Space to toggle aspect ratio lock
- Enter applies; Esc cancels

### Screen Reader Announcements

- Must announce crop dimensions: "300×300 cropping area selected"
- Announce preset selection: "Square, 1:1 aspect ratio selected"
- Announce state changes: "Crop applied" or "Crop cancelled"
- Use `aria-live` region for dynamic updates
- Modal should have `role="dialog"` and manage focus trap

### Focus Management

- Focus moves intelligently: entry → crop area → controls → confirm
- Return focus to trigger button on close

---

## 6. Recommended v1 UX for usesplash

### Entry Point

**Recommend**: **Merge into single "크롭" button** that opens a modal with tabs:

```
┌─────────────────────────────────────────────────────┐
│  [자동 크롭] [영역 크롭]              ✕           │
├─────────────────────────────────────────────────────┤
│                                                     │
│              ┌─────────────────────┐               │
│              │                     │               │
│              │    [LOGO IMAGE]      │               │
│              │                     │               │
│              │  (rule-of-thirds)   │               │
│              │                     │               │
│              └─────────────────────┘               │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [1:1]  [3:1]  [4:5]  [Free]    [초기화]           │
├─────────────────────────────────────────────────────┤
│       [취소]              [적용]                    │
└─────────────────────────────────────────────────────┘
```

### Justification

- **Merged button** reduces UI clutter (one button vs "크롭" + "영역 크롭")
- **Tabs** give clear mental model: quick auto-crop OR manual control
- Existing "크롭" users won't be disrupted; single click gets same result
- Users who need manual control discover it via tab, not separate button

### Modal Layout in Words

- **Header**: Tab bar with "자동 크롭" / "영역 크롭", close button (✕) top-right
- **Body**: Centered image with crop overlay (rule-of-thirds always visible)
- **Outside Crop**: Dimmed (#000 with 60% opacity outside selected area)
- **Crop Area**: Draggable corners only (4 handles, not 8 - simpler)
- **Drag to Reposition**: Drag inside crop area to move image
- **Footer (Aspect Pills)**: Fixed horizontal pills - "1:1" "3:1" "4:5" "Free"
- **Action Bar**: Left: "취소" (cancel, ghost button); Right: "적용" (apply, green accent)

### Grid Overlay

- **Recommendation**: **Always-on rule-of-thirds** (no toggle)
- Rationale: Non-designers benefit from composition guidance; toggle adds complexity
- Simple 2×3 grid lines overlay on crop area

### Output Behavior

- **Current pattern preserved**: Show "크롭 결과 다운로드" link after apply
- Alternative: Auto-downloads to device (may trigger browser warnings)
- Recommendation: **Persist link** - allows user to decide; consistent with existing export UX

### Existing Auto-Crop Behavior

- Current "크롭" triggers server-side auto-trim (removes whitespace)
- Keep as-is: Tab "자동 크롭" reuses same logic
- No changes to backend required

### Coexistence with Existing Export Buttons

- Gallery panel already has: "PNG 다운로드" | "크롭" | "SVG 다운로드"
- In context: These remain; crop modal opens when "크롭" is clicked
- After apply: New "크롭 결과 다운로드" link appears below (current pattern)

---

## 7. Out of Scope for v1 (Explicit Non-Goals)

| Feature | Reason for Exclusion |
|---------|---------------------|
| **Rotation** | Separate UX concern; adds complexity with aspect ratio interaction; v2 scope |
| **Color adjustment** | Not a crop concern; separate tool |
| **Filters** | Not a crop concern; separate tool |
| **Batch crop** | Single-image focus for v1; user can iterate |
| **Flip/ mirror** | Rotation family; v2 scope |
| **Grid toggle** | Always-on simpler for v1; power users can request |
| **Custom dimensions input** | Keep presets-only for simplicity; free-ratio + dragging provides flexibility |
| **Crop guide other than rule-of-thirds** | Keep minimal; add if requested |

---

## References

- Canva crop tool: https://www.canva.com/help/crop-photos-instantly/
- iOS Photos crop: https://support.apple.com/guide/iphone/crop-rotate-flip-straighten-photos-videos-iph0f3ebb1dd/ios
- Google Photos crop: https://support.google.com/photos/answer/6128850
- Instagram aspect ratios 2026: https://buffer.com/resources/instagram-image-size/
- iOS 17 quick crop: https://tech.yahoo.com/phones/articles/ios-17-lets-crop-photos-073146402.html