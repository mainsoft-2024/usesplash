## ADDED Requirements

### Requirement: Admin user list page
The system SHALL display a paginated table of all users at `/admin` showing name, email, role, project count, total generations, subscription tier, and join date. The table SHALL support search by name or email.

#### Scenario: Admin views user list
- **WHEN** an admin navigates to `/admin`
- **THEN** the system displays a table of all users sorted by most recent first with columns: name, email, role, projects count, total generations, tier, joined date

#### Scenario: Admin searches users
- **WHEN** an admin types a search query in the search field
- **THEN** the table filters to users whose name or email contains the query

#### Scenario: Non-admin access denied
- **WHEN** a non-admin user navigates to `/admin`
- **THEN** the system redirects to `/projects`

### Requirement: Admin user detail page
The system SHALL provide a detail page at `/admin/users/[id]` showing the user's full activity: projects list with logo thumbnails, chat message history per project, and generation usage stats.

#### Scenario: Admin views user detail
- **WHEN** an admin clicks a user row in the admin list
- **THEN** the system navigates to `/admin/users/[id]` showing the user's projects, each with logo thumbnails and chat messages

#### Scenario: Admin views user chat history
- **WHEN** an admin expands a project on the user detail page
- **THEN** the system displays the chat messages for that project in chronological order

### Requirement: Admin role guard on tRPC
All admin tRPC procedures SHALL verify `user.role === "admin"` and throw FORBIDDEN if not.

#### Scenario: Non-admin calls admin API
- **WHEN** a non-admin user calls any admin tRPC procedure
- **THEN** the system returns a FORBIDDEN error
