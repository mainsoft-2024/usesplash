# usage-tracking

## Purpose
Define usage event logging semantics so generation/edit/LLM events are consistently recorded with queryable cost metadata.

## Requirements

### Requirement: UsageLog event recording
The system SHALL record every image generation, edit, and LLM turn to `UsageLog`, populating cost, token, and byte fields at insert time using `lib/pricing.ts` and the inputs available at the call site.

Legacy behavior (count + type only) SHALL remain valid for historical rows until the backfill script runs. New rows MUST NOT be written with NULL cost fields when the data is available.

UsageLog schema MUST include these additional columns:
- `model: String?` — e.g. `"gemini-3-pro-image-preview"`, `"google/gemini-3-flash-preview"`
- `imageCount: Int?`
- `imageCostUsd: Decimal?` (6 dp)
- `llmInputTokens: Int?`
- `llmOutputTokens: Int?`
- `llmCostUsd: Decimal?` (6 dp)
- `blobBytes: BigInt?`
- `blobCostUsd: Decimal?` (6 dp)

`type` enum SHALL be extended to include `"llm"` in addition to existing `"generate"` and `"edit"`.

#### Scenario: Generation event records full cost
- **WHEN** the chat route's `generate_batch` tool successfully returns N images
- **THEN** the UsageLog row has `type="generate"`, `count=N`, `imageCount=N`, `imageCostUsd`, `model`, `blobBytes`, `blobCostUsd` all populated from pricing.ts

#### Scenario: Edit event records full cost
- **WHEN** `edit_logo` tool succeeds
- **THEN** row has `type="edit"`, `count=1`, `imageCount=1`, `imageCostUsd`, `blobBytes`, `blobCostUsd` populated

#### Scenario: LLM turn records token cost
- **WHEN** `streamText` `onFinish` fires
- **THEN** a row with `type="llm"`, `llmInputTokens`, `llmOutputTokens`, `llmCostUsd`, `model` is written; image and blob fields are NULL

#### Scenario: Legacy row unaffected
- **WHEN** a row was written before migration and backfill has not run
- **THEN** its cost fields remain NULL and it is still queryable by existing queries that don't depend on cost fields
