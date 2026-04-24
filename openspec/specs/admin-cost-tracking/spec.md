# admin-cost-tracking

## Purpose
Record per-event API/storage costs for admin analytics and profitability insights, using centralized pricing constants and auditable request logging.
## Requirements
### Requirement: Unit price source of truth
The system SHALL expose a single TypeScript module `web/src/lib/pricing.ts` that defines every external-API unit price (Gemini image, OpenRouter input/output token, Vercel Blob $/GB-month, Recraft vectorize) and every subscription plan monthly price. No other file MAY hardcode these numbers.

`pricing.ts` MUST export `RECRAFT_VECTORIZE_USD` (default `0.01`, overridable via env `RECRAFT_VECTORIZE_USD`).

#### Scenario: Operator changes Gemini image price
- **WHEN** operator edits `GEMINI_IMAGE_PRICE_USD` in `pricing.ts` and redeploys
- **THEN** all future UsageLog inserts use the new unit price
- **AND** admin dashboard labels reflect the new price the moment the new build is live

#### Scenario: Operator changes Recraft vectorize price
- **WHEN** operator sets `RECRAFT_VECTORIZE_USD=0.02` env var and redeploys
- **THEN** future vectorize UsageLog rows use `0.02` for `imageCostUsd`
- **AND** existing rows are unchanged (price is captured at insert time)

#### Scenario: Non-pricing file hardcodes a number
- **WHEN** a PR introduces a literal dollar figure outside `pricing.ts`
- **THEN** code review MUST reject it (enforced by convention; `pricing.ts` is the contract)

### Requirement: Per-event cost recording
The system SHALL populate cost, token, and byte fields on every `UsageLog` row at insert time. Nullable fields are permitted only for legacy rows and for event types where the data does not apply.

#### Scenario: Image generation completes successfully
- **WHEN** `generateLogoImage` returns N images and the chat route creates a UsageLog row
- **THEN** that row's `imageCount` equals N, `imageCostUsd` equals `N × GEMINI_IMAGE_PRICE_USD`, `blobBytes` equals the sum of uploaded image byte sizes, `blobCostUsd` is computed from `blobBytes × BLOB_PRICE_PER_GB_MONTH / (1024^3)` for one month, `model` is the Gemini model string

#### Scenario: Logo edit completes successfully
- **WHEN** `editLogoImage` returns one image and a UsageLog row is created
- **THEN** `imageCount=1`, `imageCostUsd = GEMINI_IMAGE_PRICE_USD`, and blob fields populated the same way

#### Scenario: LLM turn finishes
- **WHEN** the chat route's `streamText` `onFinish` fires with a defined `usage` object
- **THEN** one UsageLog row is created with `type="llm"`, `llmInputTokens=usage.inputTokens`, `llmOutputTokens=usage.outputTokens`, `llmCostUsd = (in/1_000_000)*OPENROUTER_INPUT_PRICE + (out/1_000_000)*OPENROUTER_OUTPUT_PRICE`, and image/blob fields NULL

#### Scenario: LLM usage object missing
- **WHEN** `onFinish` fires and `usage` is undefined
- **THEN** a UsageLog row is still created with `type="llm"` and `llmInputTokens`, `llmOutputTokens`, `llmCostUsd` all NULL
- **AND** the admin dashboard surfaces "N/A" for that event (never $0)

### Requirement: Historical cost backfill
The system SHALL provide `scripts/backfill-usage-costs.ts` that estimates cost for legacy UsageLog rows using current unit prices and marks them as estimated.

#### Scenario: Operator runs backfill once
- **WHEN** operator runs `pnpm tsx scripts/backfill-usage-costs.ts`
- **THEN** every UsageLog row where `imageCostUsd IS NULL AND type IN ("generate","edit")` gets `imageCostUsd = count × GEMINI_IMAGE_PRICE_USD`
- **AND** the script is idempotent — running it again leaves the same rows unchanged
- **AND** rows with `type="llm"` are left NULL (no legacy token data to estimate from)

#### Scenario: Dashboard displays backfilled data
- **WHEN** admin views the cost chart on a date range that includes backfilled rows
- **THEN** the dashboard shows a small note "Cost history estimated from current unit prices before {backfillDate}"

### Requirement: Gemini request observability
The system SHALL persist every Gemini API attempt (success, retry, failure) to a new `GeminiRequestLog` table so that admin dashboard can compute rate-limit and error rates without depending on ephemeral function logs.

#### Scenario: Gemini call succeeds on first try
- **WHEN** `generateLogoImage` or `editLogoImage` returns 2xx on attempt 1
- **THEN** one GeminiRequestLog row is written with `status="ok"`, `attempt=1`, `httpCode=200`, `latencyMs` populated, `userId` when available

#### Scenario: Gemini call retries then succeeds
- **WHEN** a Gemini call hits 429 twice then succeeds
- **THEN** 3 GeminiRequestLog rows are written — two with `status="retry"`, `httpCode=429` — and one with `status="ok"`

#### Scenario: Gemini call exhausts retries
- **WHEN** a Gemini call fails after all retries
- **THEN** the final row has `status="failed"` with the last `httpCode`

### Requirement: Recraft vectorize cost tracking
Admin cost views SHALL treat vectorize events as a first-class cost series. Queries that aggregate `imageCostUsd` SHALL include rows where `type="vectorize"` alongside `type IN ("generate","edit")`, and SHALL expose vectorize as a separate series (not merged into "image cost"). `CostTotalsRow` and `CostStackedArea` on the admin Cost tab MUST show `vectorizeUsd` as a labeled dimension.

#### Scenario: Admin Cost tab shows vectorize series
- **WHEN** admin opens the Cost tab with a date range that includes vectorize events
- **THEN** `CostTotalsRow` displays a "Vectorize" tile with the summed `imageCostUsd` for `type="vectorize"` in that range
- **AND** `CostStackedArea` renders vectorize as a distinct colored series

#### Scenario: Per-user vectorize cost
- **WHEN** admin opens a user's detail page
- **THEN** vectorize cost is included in that user's lifetime + monthly cost breakdown as a separate line

### Requirement: Recraft request observability
The system SHALL persist every Recraft vectorize API attempt to `RecraftRequestLog` (parallel to `GeminiRequestLog`), so admin dashboards can compute vectorize rate-limit and error rates.

#### Scenario: Recraft call succeeds on first try
- **WHEN** vectorize returns 200 on attempt 1
- **THEN** one row with `status="ok"`, `attempt=1`, `httpCode=200`, `latencyMs` populated, `userId`, `projectId`, `logoId`, `versionId` set

#### Scenario: Recraft call retries then succeeds
- **WHEN** a vectorize call hits 429 twice then succeeds
- **THEN** 3 rows are written — two with `status="retry"`, one with `status="ok"`

#### Scenario: Recraft call exhausts retries
- **WHEN** all retries fail
- **THEN** the final row has `status="error"` with the last `httpCode` and `errorMessage`

