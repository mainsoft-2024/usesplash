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

