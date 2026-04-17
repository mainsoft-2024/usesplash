## MODIFIED Requirements

### Requirement: Auto-assign admin role
The system SHALL automatically set `role: "admin"` for users with email `2000mageia@gmail.com` during the NextAuth sign-in or JWT callback.

#### Scenario: Admin email signs in
- **WHEN** a user with email `2000mageia@gmail.com` signs in via Google OAuth
- **THEN** the user's role is set to "admin" in the database

#### Scenario: Non-admin email signs in
- **WHEN** a user with a different email signs in
- **THEN** the user's role remains "user" (default)
