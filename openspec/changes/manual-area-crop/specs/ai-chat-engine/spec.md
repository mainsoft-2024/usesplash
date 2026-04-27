## REMOVED Requirements

### Requirement: Crop via system prompt instruction

The previous system-prompt instruction `"크롭해줘" → crop whitespace` SHALL be removed. No tool backed this instruction (there was no `export_crop` tool in the AI SDK tool list — the line was a dead reference that could cause the LLM to fabricate tool calls). Crop is UI-only in v1.

## ADDED Requirements

### Requirement: Chat redirects crop requests to gallery UI

When a user asks the assistant to crop a logo (e.g. `"크롭해줘"`, `"자를 수 있어?"`, `"여백 없애줘"`), the assistant SHALL NOT attempt to call a crop tool (none exists). The assistant SHALL respond in Korean redirecting the user to the gallery modal's "크롭" button, which offers auto + manual crop modes. The system prompt SHALL contain this guidance explicitly.

#### Scenario: User asks chat to crop

- **WHEN** a user types `크롭해줘` in the chat
- **THEN** the LLM responds with guidance directing the user to the gallery's crop button
- **AND** the LLM does NOT emit any tool call for crop
- **AND** no server crop operation is initiated

#### Scenario: Existing export-related guidance remains coherent

- **WHEN** the user asks about background removal or SVG conversion
- **THEN** the LLM's response about upcoming features stays intact
- **AND** mention of "PNG / 크롭 지원" is consistent with the new crop UI flow (crop is still supported, just via gallery UI not chat tool)
