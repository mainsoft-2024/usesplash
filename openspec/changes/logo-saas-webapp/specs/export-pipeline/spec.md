## ADDED Requirements

### Requirement: Crop whitespace
The system SHALL crop whitespace from logo images and center the content in a 1:1 square. This SHALL use the Sharp library in Node.js.

#### Scenario: Crop logo
- **WHEN** user requests crop on a logo version
- **THEN** system removes white margins, centers content in square canvas
- **AND** saves result to S3 and returns download URL

### Requirement: Background removal
The system SHALL remove backgrounds from logo images using remove.bg API. Requires REMOVE_BG_API_KEY.

#### Scenario: Remove background
- **WHEN** user requests background removal
- **THEN** system sends image to remove.bg API
- **AND** saves transparent PNG result to S3

### Requirement: SVG vectorization
The system SHALL convert raster logos to SVG using Recraft API. Requires RECRAFT_API_KEY.

#### Scenario: Convert to SVG
- **WHEN** user requests SVG export
- **THEN** system sends image to Recraft vectorize endpoint
- **AND** saves SVG result to S3 and returns download URL

### Requirement: Download exported files
The system SHALL provide presigned S3 URLs for downloading exported files.

#### Scenario: Download exported file
- **WHEN** user clicks download on an exported asset
- **THEN** browser downloads the file via presigned URL