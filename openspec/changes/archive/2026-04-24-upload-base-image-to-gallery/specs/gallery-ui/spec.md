## ADDED Requirements

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
