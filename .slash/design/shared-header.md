# Shared Header & Nav

## Architecture
A sticky, top-aligned navigation bar that provides global context and authentication state without distracting from the main content.

## Visuals
- **Height**: 64px
- **Background**: `--bg-primary` with 80% opacity and backdrop-blur (if supported), or solid `--bg-primary` with a 1px bottom border (`--border-primary`).
- **Padding**: 0 24px (Desktop), 0 16px (Mobile)

## Elements

### Left: Logo
- The "Splash" logo. Text-based, bold, white.

### Center: Navigation Links
- Only visible on desktop (hidden on mobile, moved to hamburger).
- Links: "작동 방식", "기능", "요금제"
- **Style**: Ghost buttons / text links (`--text-secondary`, hover: `--text-primary`).

### Right: Auth State

**Logged Out State**:
- "로그인" (Ghost button)
- "무료로 시작하기" (Primary button, green)

**Logged In State**:
- "대시보드" (Secondary or Ghost button)
- **User Dropdown**:
  - Avatar (or initial if no image)
  - Click opens a popover Menu (styled as a Card, `--bg-secondary`, border).
  - Menu Items:
    - User Name & Email (Read-only, `--text-secondary`)
    - Divider (`--border-primary`)
    - "대시보드로 이동"
    - "로그아웃" (Text color: red or `--text-primary`)

## Mobile Behavior
- Center nav links and Right auth buttons are collapsed into a Hamburger menu.
- Hamburger icon on the right.
- Clicking opens a full-screen or slide-out overlay with the nav links and auth CTAs.
