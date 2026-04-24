## MODIFIED Requirements

### Requirement: UsageLog event recording
The system SHALL record every image generation, edit, LLM turn, and vectorize export to `UsageLog`, populating cost, token, and byte fields at insert time using `lib/pricing.ts` and the inputs available at the call site.

Legacy behavior (count + type only) SHALL remain valid for historical rows until the backfill script runs. New rows MUST NOT be written with NULL cost fields when the data is available.

UsageLog schema MUST include these additional columns:
- `model: String?` — e.g. `"gemini-3-pro-image-preview"`, `"google/gemini-3-flash-preview"`, `"vectorize"`
- `imageCount: Int?`
- `imageCostUsd: Decimal?` (6 dp)
- `llmInputTokens: Int?`
- `llmOutputTokens: Int?`
- `llmCostUsd: Decimal?` (6 dp)
- `blobBytes: BigInt?`
- `blobCostUsd: Decimal?` (6 dp)

`type` enum SHALL be extended to include `"llm"` and `"vectorize"` in addition to existing `"generate"` and `"edit"`.

#### Scenario: Generation event records full cost
- **WHEN** the chat route's `generate_batch` tool successfully returns N images
- **THEN** the UsageLog row has `type="generate"`, `count=N`, `imageCount=N`, `imageCostUsd`, `model`, `blobBytes`, `blobCostUsd` all populated from pricing.ts

#### Scenario: Edit event records full cost
- **WHEN** `edit_logo` tool succeeds
- **THEN** row has `type="edit"`, `count=1`, `imageCount=1`, `imageCostUsd`, `blobBytes`, `blobCostUsd` populated

#### Scenario: LLM turn records token cost
- **WHEN** `streamText` `onFinish` fires
- **THEN** a row with `type="llm"`, `llmInputTokens`, `llmOutputTokens`, `llmCostUsd`, `model` is written; image and blob fields are NULL

#### Scenario: Vectorize export records full cost
- **WHEN** `export.vectorize` mutation succeeds for a version whose `svgUrl` was null
- **THEN** a row with `type="vectorize"`, `count=1`, `imageCount=1`, `model="vectorize"`, `imageCostUsd=RECRAFT_VECTORIZE_USD`, `blobBytes`, `blobCostUsd` is written

#### Scenario: Cached vectorize writes nothing
- **WHEN** `export.vectorize` returns a cached SVG URL (no API call)
- **THEN** no UsageLog row is written for that invocation

#### Scenario: Legacy row unaffected
- **WHEN** a row was written before migration and backfill has not run
- **THEN** its cost fields remain NULL and it is still queryable by existing queries that don't depend on cost fields

## ADDED Requirements

### Requirement: Recraft per-call telemetry
The system SHALL write one `RecraftRequestLog` row per Recraft API attempt (including retries) with fields: `userId`, `projectId`, `logoId?`, `versionId?`, `model` (constant `"vectorize"`), `status` (`"ok" | "retry" | "error"`), `httpCode?`, `attempt`, `latencyMs`, `errorMessage?`, `createdAt`. Indexes: `[createdAt]`, `[status, createdAt]`.

#### Scenario: Successful first attempt
- **WHEN** Recraft returns 200 on first try in 1200ms
- **THEN** one row with `status="ok"`, `httpCode=200`, `attempt=1`, `latencyMs≈1200` is written

#### Scenario: Retry then success
- **WHEN** attempt 1 returns 429 and attempt 2 returns 200
- **THEN** two rows are written: `{attempt:1, status:"retry", httpCode:429}` and `{attempt:2, status:"ok", httpCode:200}`

#### Scenario: Error without retry
- **WHEN** Recraft returns 400 on attempt 1
- **THEN** one row with `status="error"`, `httpCode=400`, `attempt=1`, `errorMessage` populated is written
