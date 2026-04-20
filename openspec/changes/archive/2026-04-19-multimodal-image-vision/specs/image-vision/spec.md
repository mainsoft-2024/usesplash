## ADDED Requirements

### Requirement: LLM image analysis
The system SHALL pass user-attached images to the LLM (OpenRouter) as `image_url` content parts so the LLM can visually analyze them. When a user attaches one or more images, the LLM SHALL automatically provide a brief analysis comment describing the image's visual characteristics before continuing the conversation.

#### Scenario: User attaches a reference image
- **WHEN** user sends a message with one or more attached images
- **THEN** the LLM receives the images as `image_url` content parts
- **AND** the LLM responds with a brief analysis of each image (colors, style, composition, mood)
- **AND** the analysis is presented in the context of logo design

#### Scenario: User attaches image with text instruction
- **WHEN** user sends "이 느낌으로 로고 만들어줘" with an attached image
- **THEN** the LLM analyzes the image, describes what it sees, and proceeds to generate logos referencing the attached image's style

### Requirement: view_logo tool
The system SHALL provide a `view_logo` tool that the LLM can call to visually inspect any logo in the project gallery. The tool SHALL accept a logo order index and optional version number, and return the logo's Blob URL along with metadata. The tool result SHALL include the image as an `image_url` part so the LLM can see it.

#### Scenario: LLM inspects a specific logo
- **WHEN** the LLM calls `view_logo` with `logoOrderIndex: 3`
- **THEN** the tool returns the latest version's Blob URL, dimensions, creation date, and version count
- **AND** the image is included in the tool result as `image_url` for LLM visual inspection

#### Scenario: LLM inspects a specific version
- **WHEN** the LLM calls `view_logo` with `logoOrderIndex: 3, versionNumber: 2`
- **THEN** the tool returns version 2's Blob URL and metadata

### Requirement: Image count safety limit
The system SHALL enforce a maximum of 5 images per LLM turn. When more than 5 images are present in the conversation context for a single turn, the system SHALL keep only the 5 most recent images. The system prompt SHALL inform the LLM of this limit.

#### Scenario: More than 5 images in conversation
- **WHEN** a conversation turn would include 7 images (from attachments + tool results)
- **THEN** the system keeps only the 5 most recent images
- **AND** older images are excluded from the LLM context for that turn

### Requirement: Reference image in generation
The system SHALL support passing reference images to the `generate_batch` tool via a `referenceImageUrls` parameter. The LLM SHALL decide when to include reference images based on conversation context. The Gemini API call SHALL include reference images as `inlineData` alongside the text prompt.

#### Scenario: Generate with reference image
- **WHEN** LLM calls `generate_batch` with `referenceImageUrls: ["https://blob.vercel.com/..."]`
- **THEN** each Gemini generation call includes the reference image(s) as `inlineData`
- **AND** the generated logos reflect the style/characteristics of the reference

#### Scenario: Generate without reference
- **WHEN** LLM calls `generate_batch` without `referenceImageUrls` or with empty array
- **THEN** generation proceeds as text-only (current behavior preserved)