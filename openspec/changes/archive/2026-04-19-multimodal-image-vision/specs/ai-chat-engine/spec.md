## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: System prompt vision instructions
The system prompt SHALL include instructions for the LLM about its image analysis capabilities. It SHALL instruct the LLM to: (1) automatically analyze attached images and comment on visual characteristics, (2) use `view_logo` tool to inspect gallery logos when needed, (3) respect the 5-image-per-turn limit, and (4) use `referenceImageUrls` in `generate_batch` when appropriate.

#### Scenario: System prompt includes vision guidance
- **WHEN** a chat session starts
- **THEN** the system prompt contains instructions about image analysis capabilities
- **AND** mentions the 5-image limit
- **AND** describes when to use `view_logo` and `referenceImageUrls`