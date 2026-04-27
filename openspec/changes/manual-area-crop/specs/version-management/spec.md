## ADDED Requirements

### Requirement: LogoVersion metadata column

The `LogoVersion` model SHALL include a nullable `metadata Json?` column whose shape (when non-null) matches the following Zod schema:

```ts
{
  source: "generate" | "edit" | "upload" | "crop_manual" | "crop_auto",
  cropRect?: { x: int, y: int, width: int, height: int }, // integer natural image pixels
  sourceVersionId?: string // cuid of the source LogoVersion
}
```

The `metadata` column SHALL be nullable to remain backwards-compatible with `LogoVersion` rows created before this change. New versions created by crop operations MUST set `metadata.source` to `"crop_manual"` or `"crop_auto"`, MUST set `metadata.sourceVersionId` to the source version's id, and MUST set `metadata.cropRect` to the extracted rect (manual) or `null` (auto). Versions with `metadata = null` SHALL be treated as legacy / unknown-source by the UI and downstream consumers.

#### Scenario: Manual crop sets metadata

- **WHEN** a new `LogoVersion` is created by a manual crop commit
- **THEN** its `metadata` field is `{ source: "crop_manual", cropRect: {x, y, width, height}, sourceVersionId: <source-id> }`
- **AND** its `parentVersionId` equals `sourceVersionId`

#### Scenario: Auto crop sets metadata

- **WHEN** a new `LogoVersion` is created by an auto-crop commit
- **THEN** its `metadata` field is `{ source: "crop_auto", cropRect: null, sourceVersionId: <source-id> }`
- **AND** its `parentVersionId` equals `sourceVersionId`

#### Scenario: Legacy versions keep null metadata

- **WHEN** a `LogoVersion` row exists that was created before this change
- **THEN** its `metadata` field is `null`
- **AND** no backfill is performed

### Requirement: Cropped versions link to source via parentVersionId

When a crop (auto or manual) commits, the new `LogoVersion` SHALL set `parentVersionId` to the source version's id. This reuses the existing `VersionTree` relation so that the gallery's tree rendering, ↑↓ navigation, and version lineage queries treat cropped versions identically to AI-edited versions.

#### Scenario: Cropped version appears in version tree

- **WHEN** a user crops version `v1` → produces `v2`
- **THEN** `v2.parentVersionId === v1.id`
- **AND** `v1.childVersions` includes `v2` via the existing `VersionTree` Prisma relation
- **AND** the gallery's ↑↓ navigation treats `v2` as a descendant of `v1`
