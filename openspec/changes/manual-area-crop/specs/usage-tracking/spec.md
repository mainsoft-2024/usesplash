## ADDED Requirements

### Requirement: UsageLog types for crop operations

The `UsageLog.type` string field SHALL accept two new values — `"crop_auto"` and `"crop_manual"` — emitted on successful crop commit. Each crop commit SHALL write exactly one `UsageLog` row with `count = 1`, `imageCount = 1`, `model = null`, `imageCostUsd = 0`, `blobBytes = <final-upload-bytes>`, `blobCostUsd = blobCost(blobBytes)`. Preview mutations SHALL NOT write `UsageLog` rows. No schema migration is required — `UsageLog.type` is already a free-form string.

#### Scenario: Manual crop commit logs usage

- **WHEN** `commitCrop` succeeds with `source = "crop_manual"`
- **THEN** exactly one `UsageLog` row is written with `type = "crop_manual"`, `count = 1`, `imageCount = 1`, `imageCostUsd = 0`, and `blobBytes` set to the final uploaded PNG size

#### Scenario: Auto crop commit logs usage

- **WHEN** `commitCrop` succeeds with `source = "crop_auto"`
- **THEN** exactly one `UsageLog` row is written with `type = "crop_auto"`, `imageCostUsd = 0`, `blobBytes > 0`

#### Scenario: Preview does not log usage

- **WHEN** `previewAutoCrop` or `previewManualCrop` is called (success or failure)
- **THEN** no `UsageLog` row is written

#### Scenario: Crop commit failure does not log usage

- **WHEN** `commitCrop` rejects (e.g. validation error, authorization error, sharp error)
- **THEN** no `UsageLog` row is written (transactional guarantee: UsageLog write is in the same transaction as LogoVersion creation)
