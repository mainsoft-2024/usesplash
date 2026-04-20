## MODIFIED Requirements

### Requirement: Batch logo generation
The system SHALL generate N logo variations based on interview results using Gemini 3 Pro Image API. Default batch size SHALL be 8. Generation SHALL happen sequentially with configurable delay to respect rate limits. When `referenceImageUrls` are provided, each generation call SHALL include the reference images as `inlineData` alongside the text prompt.

#### Scenario: Initial batch generation
- **WHEN** AI interview is complete and user confirms requirements
- **THEN** system generates 8 logo variations and displays them in the gallery as they complete
- **AND** each logo is uploaded to Blob and saved to the database

#### Scenario: Generation with reference images
- **WHEN** `generate_batch` is called with `referenceImageUrls` containing 1 or more URLs
- **THEN** the system downloads each reference image
- **AND** includes them as `inlineData` (base64) in the Gemini API call alongside the text prompt
- **AND** the generated logos reflect the referenced style

#### Scenario: Generation failure handling
- **WHEN** Gemini API returns an error or safety filter blocks a generation
- **THEN** system logs the error, skips that variation, and continues with remaining batch
- **AND** reports total successful generations to user