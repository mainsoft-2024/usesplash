## ADDED Requirements

### Requirement: Crop modal with auto + manual tabs

The gallery version modal SHALL, on "크롭" button click, swap its image + action-bar content for a **crop modal** composed of:
- A top tab bar with two tabs: `자동 크롭` and `영역 크롭`, with `영역 크롭` (manual) selected by default on first open
- A crop surface at `max-w-[85vw] max-h-[55vh]` displaying the source version's image with `touch-action: none` on the interactive wrapper
- On the manual tab: a `react-image-crop` selector with 8 handles, an always-on rule-of-thirds grid overlay, and aspect-ratio preset pills `1:1 · 4:5 · 16:9 · 자유` below the image (active pill styled with accent color)
- A real-time size label rendering the **current selection in natural image pixels** (e.g. `512 × 512px`), updated continuously during drag
- An action bar at the bottom with `[취소]` (left) and context-sensitive right-side buttons: on "select" stage `[미리보기]`; on "preview" stage `[다시 자르기] [적용]`
- Keyboard bindings: `Enter` advances the stage (select → preview, preview → commit); `Esc` closes the crop modal (returning to the image view in the outer gallery modal)
- The outer gallery modal overlay (`fixed inset-0 bg-[rgba(0,0,0,0.92)] z-50`) is preserved; the crop modal is a **content swap inside** it (not a second stacked modal)

#### Scenario: Open crop modal

- **WHEN** user clicks the "크롭" button in the gallery version modal
- **THEN** the gallery modal's image and action bar are hidden
- **AND** the crop modal content is rendered in their place with the `영역 크롭` tab active
- **AND** the manual crop selector is initialized to a centered 80%-wide 1:1 selection on image load

#### Scenario: Switch to auto-crop tab

- **WHEN** user clicks the `자동 크롭` tab from the manual tab
- **THEN** the crop selector is hidden
- **AND** a description "여백을 자동으로 제거하고 정사각으로 맞춥니다" is shown
- **AND** the `[미리보기]` button is enabled immediately (no selection required)

#### Scenario: Change aspect ratio in manual tab

- **WHEN** user clicks the `4:5` aspect pill while on the manual tab with an existing selection
- **THEN** the active pill indicator moves to `4:5`
- **AND** the selection is re-seeded to a centered 80%-of-max-dimension rect at 4:5 aspect
- **AND** the rule-of-thirds grid re-aligns to the new selection

#### Scenario: Size label updates during drag

- **WHEN** user is dragging a handle of the crop selection on a 1024×1024 source
- **THEN** the size label below/beside the selection updates in real time with the current natural-pixel dimensions (e.g. `820 × 820px`)

#### Scenario: Preview stage

- **WHEN** user clicks `[미리보기]` (either tab)
- **THEN** the server is called (`previewAutoCrop` or `previewManualCrop`)
- **AND** while pending, the button shows a spinner and crop controls are disabled
- **AND** on success the stage advances to "preview": the preview image replaces the selection UI
- **AND** `[다시 자르기]` and `[적용]` buttons are rendered

#### Scenario: Apply (commit) stage

- **WHEN** user clicks `[적용]` on the preview stage
- **THEN** the client calls `commitCrop` with `{ sourceVersionId, source, rect? }`
- **AND** while pending, the `[적용]` button shows a spinner and other crop controls are disabled
- **AND** on success the crop modal closes, the gallery modal's image view is restored, and the gallery auto-navigates to the newly created version (activeIdx points at it)

#### Scenario: Error during preview or commit

- **WHEN** the server rejects a preview or commit mutation (e.g. 400 min-size, 403 unauthorized, 500 server error)
- **THEN** a sonner toast appears with the server's error message
- **AND** the crop modal remains open on the current stage for retry
- **AND** no partial version is created

#### Scenario: Cancel at select stage

- **WHEN** user clicks `[취소]` or presses Esc on the select stage
- **THEN** the crop modal closes
- **AND** the gallery modal's original image view is restored
- **AND** no preview image was uploaded to Blob (no-op path)

#### Scenario: Cancel at preview stage

- **WHEN** user clicks `[다시 자르기]` on the preview stage
- **THEN** the stage reverts to "select" with the previous selection preserved
- **AND** the preview image is discarded from the UI (the preview blob remains orphaned in Blob storage — acceptable per design doc decision 5)

### Requirement: Crop-sourced version badge

Each rendered `LogoVersion` card and version indicator in the gallery SHALL render a "✂️ 크롭" badge when `version.metadata?.source === 'crop_manual' || version.metadata?.source === 'crop_auto'`. The badge SHALL be a small pill rendered alongside any existing REV/ORIGINAL pill, with hover tooltip `수동 크롭` (for `crop_manual`) or `자동 크롭` (for `crop_auto`). Versions with `metadata = null` (legacy pre-change versions) SHALL NOT render this badge.

#### Scenario: Badge on manual-cropped version

- **WHEN** a `LogoVersion` exists with `metadata.source = 'crop_manual'`
- **THEN** its card and indicator display a `✂️ 크롭` pill
- **AND** hovering the pill shows tooltip `수동 크롭`

#### Scenario: No badge on legacy version

- **WHEN** a `LogoVersion` exists with `metadata = null` (created before this change)
- **THEN** no crop badge is rendered on its card or indicator
- **AND** existing ORIGINAL / REV badges render unchanged

## MODIFIED Requirements

### Requirement: Two-panel layout

The application SHALL display a two-panel layout: left panel for AI chat, right panel for logo gallery. Panels SHALL be resizable. The gallery panel's version modal SHALL host the crop modal as a content-swap inside the same `fixed inset-0` overlay (no nested modal stacking).

#### Scenario: Default layout

- **WHEN** user opens a project
- **THEN** left panel shows chat interface and right panel shows logo gallery
- **AND** panel widths are approximately 40/60 split

#### Scenario: Crop modal renders inside gallery overlay

- **WHEN** user opens the crop modal from within the gallery version modal
- **THEN** the outer `fixed inset-0` gallery overlay remains mounted
- **AND** the crop modal content replaces the image + action-bar content of the gallery modal in-place
