## MODIFIED Requirements

### Requirement: Crop whitespace

The system SHALL provide two crop modes against a `LogoVersion` — **automatic whitespace trim** (`source = "crop_auto"`) and **manual area selection** (`source = "crop_manual"`) — both operating via the Sharp library in Node.js. Both modes SHALL use a 2-step **preview → commit** flow: a preview mutation returns a temporary preview image URL without side effects, and a commit mutation creates a new `LogoVersion` linked to the source version via `parentVersionId`, uploads the final image to Vercel Blob under the new version's standard storage key, and writes one `UsageLog` row (`type = "crop_auto"` or `"crop_manual"`, `count = 1`, `imageCount = 1`, `imageCostUsd = 0`, `blobBytes = <uploaded-bytes>`, `blobCostUsd = blobCost(bytes)`). Automatic crop SHALL remove near-white margins (`trim({background:"#ffffff", threshold:20})`) and composite the trimmed content centered on a square white canvas with 6 % padding. Manual crop SHALL call `sharp.extract({left,top,width,height})` with integer natural-pixel coordinates, preserve the alpha channel, and NOT re-pad or re-frame. The system SHALL clamp manual crop rects to source image bounds and SHALL reject rects whose resulting width or height is below 10 natural pixels with `TRPCError` code `BAD_REQUEST`. The legacy `export.crop` mutation SHALL be removed; callers MUST migrate to `previewAutoCrop` / `previewManualCrop` / `commitCrop`.

#### Scenario: Preview automatic crop

- **WHEN** user calls `previewAutoCrop` with `{ logoVersionId }`
- **THEN** the system runs the auto-trim pipeline on the source image
- **AND** uploads the result to Vercel Blob under a `preview/${userId}/${uuid}.png` key
- **AND** returns `{ previewUrl, previewKey, naturalWidth, naturalHeight }`
- **AND** does NOT create a `LogoVersion` or write any `UsageLog` row

#### Scenario: Preview manual crop with valid rect

- **WHEN** user calls `previewManualCrop` with `{ logoVersionId, rect: {x:50, y:50, width:400, height:400} }` on a 1024×1024 source
- **THEN** the system extracts the region, preserving alpha, and uploads a preview image
- **AND** returns `{ previewUrl, previewKey, clampedRect }` where `clampedRect` echoes the (possibly clamped) integer rect
- **AND** does NOT create a `LogoVersion` or write any `UsageLog` row

#### Scenario: Preview manual crop with out-of-bounds rect

- **WHEN** user calls `previewManualCrop` with `rect: {x:900, y:900, width:500, height:500}` on a 1024×1024 source
- **THEN** the system clamps to `{x:900, y:900, width:124, height:124}` (the maximum valid rect given the source bounds)
- **AND** returns the preview with `clampedRect: {x:900, y:900, width:124, height:124}`
- **AND** does NOT reject the request

#### Scenario: Preview manual crop with too-small rect

- **WHEN** user calls `previewManualCrop` with `rect: {x:10, y:10, width:5, height:200}` (width below minimum)
- **THEN** the system rejects with `TRPCError` code `BAD_REQUEST`, message `"크롭 영역이 너무 작습니다 (최소 10×10px)"`
- **AND** does NOT upload any preview blob

#### Scenario: Commit automatic crop

- **WHEN** user calls `commitCrop` with `{ sourceVersionId, source: "crop_auto" }`
- **THEN** the system re-runs the auto-trim pipeline (does NOT reuse the preview blob)
- **AND** creates a new `LogoVersion` with `parentVersionId = sourceVersionId`, `metadata = { source: "crop_auto", cropRect: null, sourceVersionId }`, auto-incremented `versionNumber` within the logo
- **AND** uploads the final PNG to Vercel Blob under `getStorageKey(userId, projectId, logoId, newVersionId, "png")`
- **AND** writes one `UsageLog` row with `type = "crop_auto"`, `count = 1`, `imageCount = 1`, `imageCostUsd = 0`, `blobBytes = <bytes>`, `blobCostUsd = blobCost(bytes)`
- **AND** returns `{ newVersion: { id, versionNumber, imageUrl, metadata } }`

#### Scenario: Commit manual crop

- **WHEN** user calls `commitCrop` with `{ sourceVersionId, source: "crop_manual", rect: {x:50, y:50, width:400, height:400} }`
- **THEN** the system re-runs `sharp.extract` (not reusing the preview blob), preserving alpha
- **AND** creates a new `LogoVersion` with `parentVersionId = sourceVersionId`, `metadata = { source: "crop_manual", cropRect: {x:50, y:50, width:400, height:400}, sourceVersionId }`
- **AND** uploads the final PNG to Blob under the new version's standard storage key
- **AND** writes one `UsageLog` row with `type = "crop_manual"`, `imageCostUsd = 0`
- **AND** returns `{ newVersion }`

#### Scenario: Commit manual crop rejects missing rect

- **WHEN** user calls `commitCrop` with `{ source: "crop_manual" }` but no `rect`
- **THEN** the system rejects with `TRPCError` code `BAD_REQUEST`, message indicating `rect` is required for manual crop

#### Scenario: Commit enforces min crop size server-side

- **WHEN** user calls `commitCrop` with `source = "crop_manual"` and `rect.width = 8`
- **THEN** the system rejects with `TRPCError` code `BAD_REQUEST`, message `"크롭 영역이 너무 작습니다 (최소 10×10px)"`
- **AND** does NOT create a `LogoVersion` or write a `UsageLog` row

#### Scenario: Unauthorized access rejected

- **WHEN** user calls any of `previewAutoCrop`, `previewManualCrop`, or `commitCrop` with a `logoVersionId` / `sourceVersionId` belonging to another user
- **THEN** the system rejects with `TRPCError` code `FORBIDDEN`
- **AND** no preview or commit side effects occur

#### Scenario: Legacy crop endpoint removed

- **WHEN** a client calls `export.crop` with the old `{ logoVersionId }` signature
- **THEN** the tRPC router returns a procedure-not-found error (the procedure has been deleted)
- **AND** the error message indicates the new procedures to use

### Requirement: Download exported files

The system SHALL provide direct Vercel Blob URLs for downloading exported files, including PNG, cropped PNG (as the `imageUrl` of a cropped `LogoVersion`), background-removed PNG, and SVG. Cropped outputs are first-class versions whose `imageUrl` serves as the download URL; a separate download endpoint is NOT required for cropped content. SVG URLs SHALL continue to be served from the same Blob namespace as PNGs for the same version.

#### Scenario: Download cropped version PNG

- **WHEN** user clicks download on a cropped version
- **THEN** the browser downloads the file via `LogoVersion.imageUrl` (the standard Blob URL for that version)

#### Scenario: Download exported file (non-crop)

- **WHEN** user clicks download on an exported asset (PNG, SVG)
- **THEN** the browser downloads the file via the stored Blob URL (unchanged from existing behavior)
