## ADDED Requirements

### Requirement: UsageLog data model
The system SHALL have a `UsageLog` table with fields: id, userId, projectId (optional), type (enum: "generate", "edit"), count (int), createdAt. Indexes SHALL exist on `(userId, createdAt)` and `(userId, type)`.

#### Scenario: UsageLog schema is valid
- **WHEN** the Prisma schema is inspected
- **THEN** the UsageLog model exists with the specified fields and indexes

### Requirement: Record generation events
The system SHALL create a UsageLog record every time a logo is generated or edited, capturing the userId, projectId, type, and count.

#### Scenario: Batch generation records usage
- **WHEN** a user generates 4 logos in a batch
- **THEN** the system creates a UsageLog entry with type="generate" and count=4

#### Scenario: Logo edit records usage
- **WHEN** a user edits a logo
- **THEN** the system creates a UsageLog entry with type="edit" and count=1

### Requirement: Backfill existing data
The system SHALL provide a script that counts existing LogoVersion records per user and creates UsageLog entries to represent historical generations.

#### Scenario: Backfill populates historical data
- **WHEN** the backfill script runs
- **THEN** each user's total LogoVersion count is recorded as UsageLog entries with type="generate"

### Requirement: Daily usage aggregation query
The system SHALL provide a tRPC procedure that returns daily generation counts for a given user and date range.

#### Scenario: Query daily usage for 30 days
- **WHEN** the daily usage endpoint is called with userId and days=30
- **THEN** the system returns an array of {date, count} objects for each of the last 30 days
