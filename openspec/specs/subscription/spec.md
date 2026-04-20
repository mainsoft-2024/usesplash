# subscription Specification

## Purpose
TBD - created by archiving change logo-saas-webapp. Update Purpose after archive.
## Requirements
### Requirement: Subscription tiers
The system SHALL support three subscription tiers: Free, Pro, Enterprise. Each tier SHALL have defined limits for projects, daily generations, and export features.

#### Scenario: Free tier limits
- **WHEN** Free user has 3 projects and tries to create a 4th
- **THEN** system blocks creation with upgrade prompt

#### Scenario: Free tier daily generation limit
- **WHEN** Free user has used 10 generations today and requests another
- **THEN** system blocks with "daily limit reached" message

### Requirement: Manual subscription management
Administrators SHALL be able to change user subscription tiers manually via admin page. No automated payment integration.

#### Scenario: Admin upgrades user
- **WHEN** admin changes user's tier from Free to Pro on admin page
- **THEN** user's subscription record is updated and new limits apply immediately

### Requirement: Usage tracking
The system SHALL track daily image generation count per user. Counter SHALL reset at midnight UTC.

#### Scenario: Usage counter reset
- **WHEN** midnight UTC occurs
- **THEN** all users' daily generation counters reset to 0

