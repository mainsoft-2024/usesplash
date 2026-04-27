## MODIFIED Requirements

### Requirement: Server-side image resize

The system SHALL resize uploaded and attached images on the server using `sharp` to a maximum of 512px on the longest edge, preserving aspect ratio, and output as WebP format (quality 85). This optimized image SHALL be used for both LLM vision and storage.

Resize calls SHALL be performed with `sharp` configured to enforce `limitInputPixels: 268_435_456` (sharp's 16384² default) and `failOn: "truncated"` so decompression-bomb payloads and corrupt files are rejected before consuming memory for resize.

#### Scenario: Large image upload

- **WHEN** user attaches a 3000x2000px PNG image
- **THEN** the server resizes it to 512x341px WebP
- **AND** the resized image is used for all downstream processing

#### Scenario: Small image upload

- **WHEN** user attaches a 200x200px image
- **THEN** the server keeps the original dimensions but converts to WebP

#### Scenario: Decompression bomb rejected

- **WHEN** a user uploads a file whose pixel count exceeds `limitInputPixels`
- **THEN** sharp throws before decoding
- **AND** the server returns a BAD_REQUEST error with a user-facing Korean message

## ADDED Requirements

### Requirement: Shared upload constants

The system SHALL expose a single module `src/lib/attachment-constants.ts` that is the authoritative source for image upload rules:

- `MAX_FILE_SIZE = 4 * 1024 * 1024` (4MB per file)
- `ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]` (HEIC/HEIF NOT included — sharp on the Vercel runtime lacks libheif)
- `ACCEPTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"]`
- `MAX_FILES_PER_BATCH = 10`

Both the chat composer (`src/components/chat-panel.tsx`) and the gallery upload UI (`src/components/gallery-panel.tsx`) SHALL import these constants — neither surface may define its own local copy. Any new upload surface SHALL also import from this module.

#### Scenario: Chat composer uses shared constants

- **WHEN** a user clicks the chat attachment button
- **THEN** the native file picker's `accept` attribute reflects `ACCEPTED_TYPES` from the shared module (PNG, JPEG, WebP only)
- **AND** HEIC/HEIF files are not selectable

#### Scenario: Gallery upload uses shared constants

- **WHEN** a user clicks the gallery `+ 업로드` button
- **THEN** the file picker accepts the same types as the chat composer
- **AND** files over `MAX_FILE_SIZE` are rejected with the same error message

### Requirement: Multi-layer upload validation

The system SHALL validate all uploaded image files through a multi-stage chain before persisting them to Blob or the database:

1. **Client pre-check**: Reject by MIME `file.type`, file extension, and `file.size > MAX_FILE_SIZE` with an immediate toast — no mutation is called
2. **Server size check**: After base64 decode, reject if the decoded buffer exceeds `MAX_FILE_SIZE`
3. **Server magic-byte sniffing**: Use the `file-type` npm package (`fileTypeFromBuffer`) — reject if the detected MIME is not in `ACCEPTED_TYPES`; browser-supplied MIME is not trusted
4. **Server sharp decode + pixel-bomb guard**: `sharp(buffer, { limitInputPixels: 268_435_456, failOn: "truncated" }).metadata()` — reject if sharp throws (corrupt/truncated/too-many-pixels)
5. **Server format allowlist on decoded metadata**: Reject if `metadata.format` is not one of `png`, `jpeg`, `webp`

Rejection at any stage SHALL surface a user-facing Korean error message specific to the failure mode.

#### Scenario: Spoofed MIME rejected by magic bytes

- **WHEN** a user renames `evil.pdf` to `logo.png` and uploads it (browser reports `image/png`)
- **THEN** server-side `file-type` detects `application/pdf` from the magic bytes
- **AND** the server returns BAD_REQUEST with "PNG, JPEG, WebP 형식만 지원해요."

#### Scenario: HEIC file rejected with friendly message

- **WHEN** a user tries to upload an iPhone HEIC photo
- **THEN** the client file picker filters it out via the `accept` attribute
- **OR** if drag-and-drop bypasses the picker, the client-side MIME check rejects it with "PNG, JPEG, WebP 형식만 지원해요. (아이폰 사진은 변환이 필요합니다)"

#### Scenario: Corrupt image rejected before Blob upload

- **WHEN** the server receives a truncated PNG buffer
- **THEN** sharp throws during metadata decode
- **AND** the server returns BAD_REQUEST with "이미지를 읽을 수 없어요. 파일이 손상되었을 수 있어요."
- **AND** no Blob upload or DB row is created
