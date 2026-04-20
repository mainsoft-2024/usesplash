# attachment-storage Specification

## Purpose
TBD - created by archiving change multimodal-image-vision. Update Purpose after archive.
## Requirements
### Requirement: Server-side image resize
The system SHALL resize attached images on the server using `sharp` to a maximum of 512px on the longest edge, preserving aspect ratio, and output as WebP format. This optimized image SHALL be used for both LLM vision and storage.

#### Scenario: Large image upload
- **WHEN** user attaches a 3000x2000px PNG image
- **THEN** the server resizes it to 512x341px WebP
- **AND** the resized image is used for all downstream processing

#### Scenario: Small image upload
- **WHEN** user attaches a 200x200px image
- **THEN** the server keeps the original dimensions but converts to WebP

### Requirement: Blob upload for attachments
The system SHALL upload resized attachment images to Vercel Blob and store the resulting URL in the message's file parts. The DB SHALL store Blob URLs instead of base64 data URLs.

#### Scenario: Attachment upload flow
- **WHEN** user sends a message with an attached image
- **THEN** the server receives the base64 data URL
- **AND** resizes the image with sharp (512px max, WebP)
- **AND** uploads to Vercel Blob
- **AND** stores the Blob URL in ChatMessage.parts as `{ type: "file", mediaType: "image/webp", url: "https://...blob.vercel-storage.com/..." }`

### Requirement: Backward compatibility with base64 parts
The system SHALL handle both legacy base64 data URL file parts and new Blob URL file parts when parsing stored messages.

#### Scenario: Loading old messages with base64 parts
- **WHEN** the system loads a ChatMessage with base64 data URL file parts
- **THEN** the images display correctly in the UI
- **AND** the LLM receives them as `image_url` content (data URL format)

#### Scenario: Loading new messages with Blob URL parts
- **WHEN** the system loads a ChatMessage with Blob URL file parts
- **THEN** the images display correctly in the UI
- **AND** the LLM receives them as `image_url` content (Blob URL format)

