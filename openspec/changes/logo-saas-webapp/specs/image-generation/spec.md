## ADDED Requirements

### Requirement: Batch logo generation
The system SHALL generate N logo variations based on interview results using Gemini 3 Pro Image API. Default batch size SHALL be 8. Generation SHALL happen sequentially with configurable delay to respect rate limits.

#### Scenario: Initial batch generation
- **WHEN** AI interview is complete and user confirms requirements
- **THEN** system generates 8 logo variations and displays them in the gallery as they complete
- **AND** each logo is uploaded to S3 and saved to the database

#### Scenario: Generation failure handling
- **WHEN** Gemini API returns an error or safety filter blocks a generation
- **THEN** system logs the error, skips that variation, and continues with remaining batch
- **AND** reports total successful generations to user

### Requirement: Image editing (not regeneration)
The system SHALL edit existing images by sending the source image + text prompt to Gemini API. This is editing, NOT regeneration — the source image is always provided as input.

#### Scenario: Edit existing logo
- **WHEN** user requests a modification on a specific logo version
- **THEN** system sends that version's image + edit prompt to Gemini edit endpoint
- **AND** creates a new version linked to the source version

### Requirement: Gemini API TypeScript integration
The system SHALL use @google/genai SDK in TypeScript. The API key SHALL be configurable via environment variable GEMINI_API_KEY.

#### Scenario: API key validation
- **WHEN** server starts without GEMINI_API_KEY set
- **THEN** image generation routes return 503 with clear error message