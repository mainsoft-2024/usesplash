## ADDED Requirements

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
The system SHALL interpret natural language modification requests and translate them into image editing commands. Users SHALL be able to specify which logo to modify by number and describe changes in natural language.

#### Scenario: Numbered modification request
- **WHEN** user sends "3번 로고에서 색상을 빨간색으로 바꿔줘"
- **THEN** system identifies logo #3, extracts edit prompt "change color to red", and triggers image edit on that logo

#### Scenario: Version-specific modification
- **WHEN** user sends "v4 기반으로 텍스트를 제거해줘"
- **THEN** system identifies version 4 of the referenced logo and applies text removal edit using that version as input

### Requirement: OpenRouter LLM integration
The system SHALL use OpenRouter API for LLM inference. Administrators SHALL be able to configure which model to use. The chat SHALL support streaming responses.

#### Scenario: Streaming chat response
- **WHEN** AI generates a response to user message
- **THEN** response is streamed token-by-token to the chat UI

#### Scenario: Model configuration
- **WHEN** administrator changes the OpenRouter model in settings
- **THEN** subsequent chat messages use the new model

### Requirement: Chat message persistence
The system SHALL persist all chat messages (user and AI) per project. Messages SHALL be associated with generated/edited images when applicable.

#### Scenario: Chat history on project reopen
- **WHEN** user reopens an existing project
- **THEN** full chat history is loaded and displayed in the chat panel