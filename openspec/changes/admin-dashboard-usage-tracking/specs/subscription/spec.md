## MODIFIED Requirements

### Requirement: Generation records usage log
The system SHALL record a UsageLog entry whenever `Subscription.dailyGenerations` is incremented, in addition to the existing counter update. The UsageLog entry SHALL include userId, projectId, type, and count.

#### Scenario: Generation increments both counter and log
- **WHEN** a generation completes and dailyGenerations is incremented
- **THEN** the system also creates a UsageLog record with matching count
