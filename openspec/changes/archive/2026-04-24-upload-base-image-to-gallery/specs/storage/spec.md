## ADDED Requirements

### Requirement: Uploaded images use the Logo/LogoVersion model

User-uploaded images SHALL be stored as regular `Logo` rows with a single v1 `LogoVersion`, indistinguishable in shape from AI-generated logos. The Logo SHALL have `prompt = "(업로드된 이미지)"`, `aspectRatio = "1:1"` (inert placeholder — actual aspect ratio is preserved in the stored file), and its `orderIndex` SHALL be assigned as the next integer after the current maximum in the project (same rule used by `generateBatch`).

The LogoVersion SHALL have `versionNumber = 1`, `editPrompt = null`, `svgUrl = null`, `parentVersionId = null`, `chatMessageId = null`. Its `imageUrl` and `s3Key` SHALL use the same `getStorageKey(userId, projectId, logoId, "v1")` structure as generated images (`users/{userId}/projects/{projectId}/logos/{logoId}/v1.webp`).

Uploaded LogoVersions SHALL be indistinguishable from AI-generated LogoVersions to every downstream consumer — mention citation, `edit_logo` tool, crop export, SVG vectorize export, and version-tree rendering — requiring no changes to those consumers.

#### Scenario: Uploaded image becomes a regular logo

- **WHEN** `logo.uploadBaseImage` mutation succeeds with `projectId=P`
- **THEN** a new `Logo` row exists with `prompt="(업로드된 이미지)"`, `projectId=P`, and `orderIndex` equal to the previous max in P plus 1
- **AND** a new `LogoVersion` row exists with `versionNumber=1`, `editPrompt=null`, `svgUrl=null`, `parentVersionId=null`
- **AND** the version's `imageUrl` is a Vercel Blob URL pointing to the resized WebP

#### Scenario: Uploaded logo is citable via mention

- **WHEN** a user hovers an uploaded logo's card and clicks its "@ 인용" button
- **THEN** the chat composer gains a mention chip for that version, identical to mentions of generated logos

#### Scenario: Uploaded logo is editable via edit_logo

- **WHEN** the AI invokes `edit_logo` with a `referencedVersions` list that includes an uploaded version
- **THEN** the edit succeeds and a v2 LogoVersion is created with `parentVersionId` pointing to the uploaded v1
