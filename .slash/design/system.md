# Design System: Splash

## Generated Recommendations
- **Palette**: Monochromatic dark base with vibrant, singular accent (Green).
- **Typography**: Inter or similar clean sans-serif for high legibility in UI.
- **Style**: High contrast, subtle depth through borders rather than heavy shadows. Terminal-meets-studio aesthetic.
- **Anti-patterns**: Avoid heavy drop shadows, excessive use of multiple accent colors, or low-contrast text.

## Craft Decisions
- **Direction**: A focused, distraction-free "studio" environment. Dark, precise, and professional. It should feel like a high-end creative tool, not a generic SaaS.
- **Signature**: The glowing green accent (`--accent-green`) used sparingly to guide the eye to the most important action (generation).
- **Depth**: Borders-only. We use subtle 1px borders (`--border-primary`, `--border-secondary`) to define structure, avoiding soft shadows to maintain a crisp, digital feel.
- **Spacing**: Base unit of 4px. 
  - Micro: 4px, 8px
  - Component: 16px, 24px
  - Section: 48px, 64px, 96px
- **Typography**: Clean Sans-Serif. 
  - Headlines: Tight tracking, bold.
  - Body: Comfortable weight, high line-height for readability.
  - Data/Labels: Medium weight, slightly smaller.
- **Color temperature**: Cool/Neutral darks (`--bg-primary` #0e0e0e) to let the user's generated logos provide the color and warmth.

## Component Patterns

### Typography Scale
- **H1**: 3rem (48px), 1.2 lh, bold, tight tracking
- **H2**: 2.25rem (36px), 1.2 lh, semibold
- **H3**: 1.5rem (24px), 1.3 lh, medium
- **Body Large**: 1.125rem (18px), 1.6 lh, text-secondary
- **Body**: 1rem (16px), 1.6 lh, text-secondary
- **Small/Label**: 0.875rem (14px), text-tertiary

### Buttons
- **Primary**: Background `--accent-green`, text `#000`. Hover: `--accent-green-hover`. No border.
- **Secondary**: Background transparent, border `--border-secondary`, text `--text-primary`. Hover: background `--bg-tertiary`.
- **Ghost**: Background transparent, text `--text-secondary`. Hover: text `--text-primary`.

### Cards
- Background: `--bg-secondary`
- Border: 1px solid `--border-primary`
- Radius: 12px
- Padding: 24px

### States
- **Hover**: Subtle background lightness shift or border color change.
- **Focus**: 2px solid `--accent-green` outline with 2px offset.
- **Disabled**: Opacity 50%, unclickable.
