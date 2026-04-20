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

