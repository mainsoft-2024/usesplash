## ADDED Requirements

### Requirement: OAuth authentication
The system SHALL support OAuth login via Google and GitHub using NextAuth v5. JWT strategy SHALL be used for sessions.

#### Scenario: Google login
- **WHEN** user clicks "Sign in with Google"
- **THEN** user is redirected to Google OAuth, then back to app with session created

#### Scenario: GitHub login
- **WHEN** user clicks "Sign in with GitHub"
- **THEN** user is redirected to GitHub OAuth, then back to app with session created

### Requirement: Session management
Sessions SHALL be managed via JWT tokens. Protected routes SHALL redirect unauthenticated users to login page.

#### Scenario: Access protected route without session
- **WHEN** unauthenticated user navigates to /projects
- **THEN** user is redirected to /login

### Requirement: User profile
The system SHALL store user profile (name, email, avatar) from OAuth provider. User record SHALL be created on first login.

#### Scenario: First-time login
- **WHEN** user logs in for the first time
- **THEN** system creates User record with OAuth profile data