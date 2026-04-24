# ai-chat-engine Specification

## Purpose
TBD - created by archiving change logo-saas-webapp. Update Purpose after archive.
## Requirements
### Requirement: AI interview flow
The system SHALL conduct a structured interview via chat to gather logo design requirements. The AI SHALL ask about: brand name, style preference, aspect ratio, color preferences, and reference images. Once all required information is collected, the AI SHALL confirm requirements and proceed to generation.

#### Scenario: Complete interview flow
- **WHEN** user starts a new project and sends first message
- **THEN** AI responds with the first interview question (brand name)
- **AND** continues asking follow-up questions until all requirements are gathered
- **AND** presents a summary for user confirmation before generating

#### Scenario: Partial information provided upfront
- **WHEN** user provides multiple requirements in first message (e.g. "Make a pixel art logo for TechCorp in blue")
- **THEN** AI extracts provided info and only asks about missing requirements

### Requirement: Modification request parsing
The system SHALL interpret natural language modification requests and translate them into image editing commands. Users SHALL be able to specify which logo to modify EITHER by **structured mention chips** (preferred) OR by free-text references such as "3번 로고" / "#3 v2" (legacy, still supported). When mentions are present, the LLM SHALL pass the mentioned `versionId`s to the `edit_logo` tool via `referencedVersions` and SHALL choose `outputMode` between `"new_version"` (modifying an existing logo) and `"new_logo"` (composing/combining into a new logo entry).

#### Scenario: Numbered modification request
- **WHEN** user sends "3번 로고에서 색상을 빨간색으로 바꿔줘" with no mentions
- **THEN** system identifies logo #3 via `logoOrderIndex` and triggers an edit on its latest version (existing behaviour)

#### Scenario: Version-specific modification
- **WHEN** user sends "v4 기반으로 텍스트를 제거해줘"
- **THEN** system identifies version 4 of the referenced logo and applies text removal edit using that version as input

#### Scenario: Mention-driven edit produces a new version
- **WHEN** the user mentions exactly `#3 v2` and writes "색상을 빨간색으로"
- **THEN** the LLM calls `edit_logo` with `referencedVersions: [<v2 id>]` and `outputMode: "new_version"`
- **AND** a new version is appended to logo #3

#### Scenario: Multi-mention compose creates a new logo
- **WHEN** the user mentions `#1 v1` and `#2 v1` and writes "두 로고를 합쳐줘"
- **THEN** the LLM calls `edit_logo` with `referencedVersions: [<id1>, <id2>]` and `outputMode: "new_logo"`
- **AND** a new `Logo` row is created with `orderIndex = max+1`, holding the result as `versionNumber: 1` and `parentVersionId = referencedVersions[0]`

### Requirement: OpenRouter LLM integration
The system SHALL use OpenRouter API for LLM inference with multimodal support. When user messages contain file parts (images), the system SHALL convert them to OpenRouter's `image_url` content format before sending to the LLM. Administrators SHALL be able to configure which model to use. The chat SHALL support streaming responses.

#### Scenario: Streaming chat response
- **WHEN** AI generates a response to user message
- **THEN** response is streamed token-by-token to the chat UI

#### Scenario: Model configuration
- **WHEN** administrator changes the OpenRouter model in settings
- **THEN** subsequent chat messages use the new model

#### Scenario: Message with images sent to LLM
- **WHEN** a user message contains file parts with image URLs
- **THEN** the system converts them to `{ type: "image_url", image_url: { url: "..." } }` format
- **AND** includes them in the user message content array sent to OpenRouter
- **AND** text content is placed before image content for optimal parsing

### Requirement: Chat message persistence
The system SHALL persist all chat messages (user and AI) per project. Messages SHALL be associated with generated/edited images when applicable.

#### Scenario: Chat history on project reopen
- **WHEN** user reopens an existing project
- **THEN** full chat history is loaded and displayed in the chat panel

### Requirement: System prompt vision instructions
The system prompt SHALL include instructions for the LLM about its image analysis capabilities. It SHALL instruct the LLM to: (1) automatically analyze attached images and comment on visual characteristics, (2) use `view_logo` tool to inspect gallery logos when needed, (3) respect the 5-image-per-turn limit, (4) use `referenceImageUrls` in `generate_batch` when appropriate, and (5) **when the user has attached `data-mention` parts, treat them as the ground-truth subjects of the request and pass their `versionId`s through `edit_logo.referencedVersions` rather than guessing from text**.

#### Scenario: System prompt includes vision guidance
- **WHEN** a chat session starts
- **THEN** the system prompt contains instructions about image analysis capabilities
- **AND** mentions the 5-image limit
- **AND** describes when to use `view_logo` and `referenceImageUrls`

### Requirement: Structured logo-version mentions in chat messages
The system SHALL allow a user message to carry zero or more structured **logo-version mention parts** alongside its text. Each mention part SHALL identify exactly one `LogoVersion` belonging to the active project and SHALL be persisted inside the existing `ChatMessage.parts` JSON column under `type: "data-mention"` with fields `logoId`, `versionId`, `orderIndex`, `versionNumber`, and `imageUrl`. A message SHALL carry at most **3** mention parts.

#### Scenario: User attaches mentions and sends
- **WHEN** a user composes a message with two mention chips and types "두 로고를 합쳐줘"
- **THEN** the request to `/api/chat` carries the latest user message with `parts` containing one `text` part and two `data-mention` parts
- **AND** the message is persisted with those parts intact

#### Scenario: Mention cap enforced
- **WHEN** a user attempts to add a 4th mention chip
- **THEN** the system rejects the addition and shows a "최대 3개까지 멘션할 수 있어요" toast
- **AND** the composer state still contains exactly 3 mentions

#### Scenario: Backwards compatibility with legacy text references
- **WHEN** a user sends a message with no mention parts but text "#3 v2 색상을 빨강게"
- **THEN** the system continues to handle the request via the existing text-based logic (no regression)

### Requirement: Mention validation at submit
The chat route SHALL verify, for every `data-mention` part on the latest user message, that the `versionId` exists AND that its parent `Logo` belongs to the request's `projectId`. On any mismatch the route SHALL respond `400` with body `{ error: "mention_invalid", missingVersionIds: string[] }` and SHALL NOT call the LLM.

#### Scenario: Mentioned version was deleted
- **WHEN** a user submits a message mentioning a `versionId` that no longer exists
- **THEN** the route returns `400 { error: "mention_invalid", missingVersionIds: [...] }`
- **AND** the LLM is not invoked

#### Scenario: Cross-project mention
- **WHEN** a user submits a message whose mention `versionId` belongs to a different project's logo
- **THEN** the route returns `400 { error: "mention_invalid", ... }`

### Requirement: Mentioned images injected into LLM message
For every valid mention on the latest user message, the chat route SHALL append a `file` part (`mediaType: "image/<actual>"`, `url: imageUrl`) to that user message before calling the LLM, so the model receives the actual logo image as a multimodal input. The route SHALL also add the mention's `imageUrl` to the existing `allowedReferenceUrls` set so downstream tool calls referencing those URLs are permitted.

#### Scenario: Two mentions become two image parts
- **WHEN** the latest user message has 2 valid mentions
- **THEN** the message sent to the LLM has 2 additional `file` parts with the mention image URLs
- **AND** both URLs are present in `allowedReferenceUrls`

### Requirement: System prompt enumerates mentioned versions
When the latest user message contains at least one valid mention, the system prompt SHALL include a "User-mentioned logo versions (THIS TURN)" section listing each mention's `logoId`, display index (`orderIndex + 1`), `versionNumber`, and a prompt summary (≤200 chars). When there are no mentions, the section SHALL be omitted.

#### Scenario: Mentions present
- **WHEN** the user message contains 2 mentions
- **THEN** the system prompt contains a "User-mentioned logo versions (THIS TURN)" block with 2 bulleted entries

#### Scenario: No mentions
- **WHEN** the user message contains zero mentions
- **THEN** the system prompt does NOT contain the mentioned-versions block
