## ADDED Requirements

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
