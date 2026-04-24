## MODIFIED Requirements

### Requirement: SVG vectorization
The system SHALL convert raster logos to SVG using the Recraft API and immediately persist the resulting SVG to Vercel Blob. The produced SVG URL SHALL be stored on the source `LogoVersion.svgUrl` field for idempotent re-download. The system MUST NOT retain any third-party provider-side storage. Requires `RECRAFT_API_KEY`.

Every vectorize attempt SHALL write one `RecraftRequestLog` row capturing userId, projectId, logoId, versionId, status, httpCode, attempt, latencyMs, and errorMessage. Transient failures (HTTP 429 / 5xx) SHALL be retried with exponential backoff up to 3 attempts (2s → 4s → 8s). Non-transient failures SHALL surface immediately to the caller.

On the first successful vectorize for a given `LogoVersion`, the system SHALL write a `UsageLog` row with `type="vectorize"`, `count=1`, `imageCount=1`, `imageCostUsd=RECRAFT_VECTORIZE_USD` (env, default `0.01`), `model="vectorize"`, `blobBytes`, `blobCostUsd`. Subsequent calls for the same version SHALL short-circuit (no Recraft call, no UsageLog row) and return the existing `svgUrl`.

#### Scenario: First-time vectorize
- **WHEN** user requests SVG export on a version whose `svgUrl` is null
- **THEN** system uploads the SVG to Vercel Blob under the version's storage key with `.svg` extension
- **AND** sets `LogoVersion.svgUrl` to the Blob URL
- **AND** writes one `RecraftRequestLog` row with `status="ok"` and the final `httpCode`
- **AND** writes one `UsageLog` row with `type="vectorize"` and `imageCostUsd=RECRAFT_VECTORIZE_USD`
- **AND** returns `{ url, key, cached: false }`

#### Scenario: Repeat vectorize on same version
- **WHEN** user requests SVG export on a version whose `svgUrl` is already set
- **THEN** no Recraft API call is made
- **AND** no `RecraftRequestLog` or `UsageLog` row is written
- **AND** the existing `svgUrl` is returned with `cached: true`

#### Scenario: Transient 429 retried
- **WHEN** Recraft returns HTTP 429 on attempt 1
- **THEN** the system waits ~2s and retries
- **AND** writes one `RecraftRequestLog` row per attempt (attempt 1 with `status="retry"`, attempt 2 with `status="ok"` or `status="retry"`)

#### Scenario: Non-transient failure surfaces
- **WHEN** Recraft returns HTTP 400 with an invalid image
- **THEN** the system does not retry
- **AND** writes one `RecraftRequestLog` row with `status="error"`, `httpCode=400`, `errorMessage` populated
- **AND** the mutation rejects with an error surfaced to the client

#### Scenario: All retries exhausted
- **WHEN** three consecutive attempts return 5xx
- **THEN** three `RecraftRequestLog` rows are written (attempts 1-2 `status="retry"`, attempt 3 `status="error"`)
- **AND** no `UsageLog` row is written
- **AND** the mutation rejects

### Requirement: Download exported files
The system SHALL provide direct Vercel Blob URLs for downloading exported files, including PNG, cropped PNG, background-removed PNG, and SVG. SVG URLs SHALL be served from the same Blob namespace as PNGs for the same version.

#### Scenario: Download exported file
- **WHEN** user clicks download on an exported asset
- **THEN** browser downloads the file via the stored Blob URL
