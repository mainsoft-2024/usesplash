# Design System: Projects Dashboard

## Overview
The projects dashboard is the user's entry point into the "studio" environment. 
Instead of plain text cards, we are moving to a visually rich gallery-style dashboard that highlights the user's creative output (their generated logos).

## Craft Decisions
- **Direction**: A "creator's workspace" or "studio gallery". It should feel like a high-end portfolio overview. The focus is on the generated visuals, not the interface chrome.
- **Layout**: Keep the responsive grid (1/2/3 columns based on screen size), but increase the vertical rhythm to accommodate thumbnail galleries. 
- **Depth & Interaction**: We stick to the system's "borders-only" depth. Cards are defined by 1px `--border-primary`. On hover, the border shifts to `--accent-green`, and the thumbnails slightly scale (internal image scale) to indicate interactivity.

## Component Patterns

### 1. Page Header
- **Structure**: A clear, distraction-free header.
- **Typography**: 
  - Title: "Splash" with the "lash" in `--accent-green` (existing pattern).
  - Subtitle: "AI 로고 디자인 프로젝트" (Text-tertiary).
- **Primary Action**: The "+ 새 프로젝트" button. Keep it prominent, using the primary button pattern (`bg-[var(--accent-green)]`).

### 2. Project Card (Gallery Card)
- **Container**: 
  - Background: `--bg-secondary`
  - Border: 1px solid `--border-primary`
  - Radius: 16px (slightly larger to frame images beautifully)
  - Hover State: Border changes to `--accent-green`, cursor becomes pointer.
- **Thumbnail Area (Top portion, 180px fixed height)**:
  - **Grid System**: 
    - 0 Logos: Subtle dark canvas (`--bg-primary`) with a minimal "spark" or "image" icon, reinforcing the "waiting for creation" vibe.
    - 1 Logo: Fills the entire 180px area (`object-cover`).
    - 2 Logos: Split 50/50 vertically.
    - 3+ Logos: 1 large on the left (60%), 2 small stacked on the right (40%).
  - **Image Styling**: Images should be `object-cover`. On card hover, a subtle CSS transform (`scale-105`) applies to the images inside a hidden overflow container.
- **Metadata Area (Bottom portion, Padding: 20px)**:
  - **Header**: Flex row. Project Name takes up available space. Truncated if too long. Text size 18px (Body Large), medium weight.
  - **Description**: Text size 14px, `--text-secondary`, line-clamp-1. (Only show if description exists).
  - **Stats & Date**: Small/Label (12px), `--text-tertiary`. Format: "N개의 로고 · N개의 버전 · YYYY.MM.DD".
  - **Delete Action**: A subtle trash icon button (Ghost style) in the bottom right corner, visible only on card hover, or placed carefully to not distract.

### 3. Global Empty State (0 Projects)
- **Container**: Large area with 1px dashed border (`--border-primary`) and `--bg-secondary` background. Radius 16px.
- **Content**: Centered minimal icon, "아직 프로젝트가 없습니다" text, and a primary "+ 새 프로젝트" button inside the empty state itself.

## Guidelines for Developers
- Modify the tRPC router to fetch up to 3 recent logo version image URLs per project.
- Structure the card as a `flex-col` with `overflow-hidden`. The top `div` holds the image grid, the bottom `div` holds the text padding.
- Ensure images load gracefully (perhaps a subtle fade-in).
- Dark theme adherence: Keep backgrounds pure darks, letting the generated logos provide all the color.