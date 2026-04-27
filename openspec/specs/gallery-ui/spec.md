# gallery-ui Specification

## Purpose
TBD - created by archiving change logo-saas-webapp. Update Purpose after archive.
## Requirements
### Requirement: Two-panel layout
The application SHALL display a two-panel layout: left panel for AI chat, right panel for logo gallery. Panels SHALL be resizable.

#### Scenario: Default layout
- **WHEN** user opens a project
- **THEN** left panel shows chat interface and right panel shows logo gallery
- **AND** panel widths are approximately 40/60 split

### Requirement: Card-based gallery
The gallery SHALL display logos as card groups. Each card group contains the original logo and all its revision versions. Cards SHALL show the currently active version's image.

#### Scenario: Card display
- **WHEN** gallery loads with logos
- **THEN** each logo is shown as a card with image, label, and version indicator
- **AND** cards with revisions show REV badge and version dots

### Requirement: Keyboard navigation
The gallery SHALL support keyboard navigation: ↑↓ to switch between original and revision versions within a card, ←→ to move between different logos.

#### Scenario: Version switching with arrow keys
- **WHEN** user presses ↑ or ↓ on a card in modal view
- **THEN** the displayed version switches between original and revisions
- **AND** version dots update to reflect current version

#### Scenario: Logo browsing with arrow keys
- **WHEN** user presses ← or → in modal view
- **THEN** the next/previous logo card is displayed

### Requirement: Modal full-screen view
The gallery SHALL support a modal/lightbox view for detailed inspection. Modal SHALL show version navigation (↑↓), logo navigation (←→), and version dots.

#### Scenario: Open modal
- **WHEN** user clicks a gallery card
- **THEN** modal opens with full-size image view and navigation controls

### Requirement: Version indicators
Cards with revisions SHALL display: version dots (one dot per version, active dot highlighted), REV badge on revision versions, ORIGINAL pill on original version.

#### Scenario: Version dot display
- **WHEN** a logo has 3 revisions
- **THEN** card shows 4 dots (1 original + 3 revisions), active dot highlighted in green

### Requirement: Per-version "@ 인용" affordance in gallery
Each rendered logo version card in the gallery panel SHALL expose an "@ 인용" icon button (hover-revealed). Clicking the button SHALL push that version into the active project's chat composer as a mention chip via the shared composer store, subject to the 3-mention cap and same-project guard.

#### Scenario: Cite a version into the composer
- **WHEN** a user hovers a version card and clicks its "@ 인용" button
- **THEN** the chat composer for that project gains a chip representing that version
- **AND** the chip appears above the textarea without modifying the typed text

#### Scenario: Cap at 3
- **WHEN** the composer already has 3 chips and the user clicks "@ 인용" on a 4th version
- **THEN** no chip is added and a "최대 3개까지 멘션할 수 있어요" toast is shown

#### Scenario: Cross-project guard
- **WHEN** the gallery shown is for project A but the active composer focus is project B
- **THEN** the "@ 인용" button is disabled with a tooltip explaining the mismatch

### Requirement: Click-to-highlight from chat history
A mention chip rendered inside the chat history SHALL, when clicked, scroll the gallery to the corresponding version card and briefly highlight it (≥1s). If the version no longer exists, the chip SHALL render in a disabled "삭제됨" state and be non-interactive.

#### Scenario: Click historical chip
- **WHEN** a user clicks a mention chip inside an older chat message
- **THEN** the gallery panel scrolls the corresponding version into view and applies a temporary highlight

#### Scenario: Deleted version chip
- **WHEN** a historical chip references a version that has been deleted
- **THEN** the chip is rendered greyed-out with a "삭제됨" label and clicks have no effect

### Requirement: SVG download in version modal
The gallery version modal SHALL expose a functional "SVG 다운로드" button alongside the existing "PNG 다운로드" button. Clicking the button SHALL trigger the `export.vectorize` mutation, show an inline spinner with the button disabled while pending, and on success trigger an automatic browser download of the resulting SVG. Subsequent clicks on the same version SHALL use the cached `svgUrl` (no re-vectorize).

#### Scenario: First SVG download
- **WHEN** user clicks "SVG 다운로드" on a version with null `svgUrl`
- **THEN** the button shows a spinner and becomes disabled
- **AND** the server vectorizes the image and returns a Blob URL
- **AND** the browser downloads the file automatically on success
- **AND** the button re-enables

#### Scenario: Cached SVG download
- **WHEN** user clicks "SVG 다운로드" on a version whose `svgUrl` is already set
- **THEN** no API call is made and the browser downloads the existing SVG within ~100ms

#### Scenario: Error UX
- **WHEN** vectorize fails after all retries
- **THEN** the button re-enables and an error toast is shown
- **AND** no partial file is downloaded

### Requirement: Gallery image upload entry points

The gallery panel SHALL expose two entry points for uploading an image file from the user's device: (1) a `+ 업로드` button placed in the header between the logo count span and the refresh button, and (2) the same button rendered prominently inside the empty-state card. Both entry points SHALL open the native file picker with `multiple` enabled and `accept` limited to the shared `ACCEPTED_TYPES` allowlist (PNG, JPEG, WebP — HEIC/HEIF excluded).

#### Scenario: Upload button in populated gallery

- **WHEN** a user is viewing a project that already has logos
- **THEN** the header displays `{N}개 로고 · {M}개 수정본 | + 업로드 | ↻` with `+ 업로드` as a clickable button
- **AND** clicking the button opens the native file picker restricted to PNG/JPEG/WebP

#### Scenario: Upload button in empty-state card

- **WHEN** the project has no logos
- **THEN** the empty-state card displays "AI와 대화하거나 가지고 계신 이미지를 업로드하세요" copy
- **AND** a primary-styled `+ 업로드` button is rendered inside the card
- **AND** clicking the button opens the native file picker with the same constraints

### Requirement: Gallery-wide drag-and-drop upload

The gallery panel container SHALL accept dropped image files anywhere inside its bounding box. While the user is dragging files over the panel, a full-panel overlay SHALL appear with "여기에 놓아주세요" copy and a dashed border. Dropping files SHALL hand them to the same upload handler as the file-picker path.

The drag state SHALL use a counter to correctly handle `dragenter`/`dragleave` events firing on nested child elements so the overlay does not flicker. Non-image files in the drop SHALL be filtered out silently.

#### Scenario: Drag files onto gallery

- **WHEN** a user drags one or more image files from their desktop over the gallery panel
- **THEN** an overlay appears covering the panel with "여기에 놓아주세요" and a dashed-border drop zone

#### Scenario: Drop files onto gallery

- **WHEN** a user releases a drag over the gallery with 2 image files and 1 PDF
- **THEN** the overlay disappears
- **AND** the 2 image files are passed to the upload handler
- **AND** the PDF is ignored silently

#### Scenario: Drag leaves gallery

- **WHEN** a user drags files out of the gallery bounds without dropping
- **THEN** the overlay disappears without starting an upload

### Requirement: Optimistic skeleton cards during upload

While a file upload mutation is in flight, the gallery grid SHALL render a pulsing gray skeleton card at the end of the grid for each pending file, visually consistent with the existing "generating" tool activity state. On mutation success, the skeleton SHALL be removed and the real card SHALL appear via tRPC query invalidation. On mutation error, the skeleton SHALL flip to an error variant (red border + X icon) for approximately 3 seconds before auto-dismissing; a toast SHALL surface the error message.

#### Scenario: Uploading one file shows a skeleton then real card

- **WHEN** a user selects a single 300KB PNG
- **THEN** a pulsing skeleton card appears immediately at the end of the grid
- **AND** the mutation completes within ~2s
- **AND** the skeleton is replaced by the real logo card (same position in the grid)

#### Scenario: Upload error shows error skeleton then dismisses

- **WHEN** the server rejects a file (e.g. 503 upstream error)
- **THEN** the pending skeleton gains a red border and X icon
- **AND** a toast appears with the Korean error message
- **AND** the error skeleton auto-removes after approximately 3 seconds

### Requirement: Multi-file batch upload cap

The gallery SHALL accept up to `MAX_FILES_PER_BATCH = 10` files per selection or drop. If the user selects more, the gallery SHALL upload only the first 10 and surface a toast explaining the cap.

Files SHALL be uploaded **sequentially** (one mutation at a time). After the batch completes, if more than one file was involved, a summary toast SHALL report `{succeeded}/{total}개 업로드 완료`.

#### Scenario: Batch of 15 files

- **WHEN** a user selects 15 PNG files in the file picker
- **THEN** a warning toast appears: "한 번에 최대 10개까지 업로드할 수 있어요. 처음 10개만 업로드해요."
- **AND** the first 10 files are uploaded sequentially
- **AND** the remaining 5 are ignored

#### Scenario: Partial failure in batch

- **WHEN** a batch of 3 files uploads and the 2nd fails due to a decode error
- **THEN** file 1 succeeds and its card appears
- **AND** file 2's skeleton shows an error state + a file-specific error toast surfaces
- **AND** file 3 continues and succeeds
- **AND** after the batch completes, a summary toast reports "2/3개 업로드 완료"

