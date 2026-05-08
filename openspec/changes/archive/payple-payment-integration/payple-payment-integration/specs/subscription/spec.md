## MODIFIED Requirements

### Requirement: Manual subscription management
Administrators SHALL be able to change user subscription tiers manually via admin page **as an override path**. The primary path for tier changes SHALL be the `payment-processing` capability — `tier="pro"` SHALL be set only by a successful Payple charge, and `tier="free"` SHALL be set only by cancellation grace expiry, three-strike auto-downgrade, or admin override. No other code path SHALL write `tier`.

#### Scenario: Admin overrides user
- **WHEN** admin changes user's tier from Free to Pro on admin page via `subscription.adminUpdateTier`
- **THEN** user's subscription record is updated and new limits apply immediately
- **AND** no Payple charge is created (admin override is unbilled)

#### Scenario: Payment is the normal path
- **WHEN** a user successfully completes a Payple checkout
- **THEN** `payment-processing` writes `tier="pro"` (not the admin path)

#### Scenario: Direct tier writes are forbidden
- **WHEN** any router other than `payment.*`, `subscription.adminUpdateTier`, or the renewal cron attempts to mutate `tier`
- **THEN** that code path SHALL be rejected at code review (enforced via grep-based test)
