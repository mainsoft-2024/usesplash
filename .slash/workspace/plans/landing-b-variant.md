# Landing A/B + Prompt Caption Cleanup (nonspec)

## Scope
- Keep A (현재) as-is.
- Add B variant: **copy-driven** — rotating headline cycling through refined 한글 반말 captions, v20 as hero, tight CTA.
- A/B split via `?v=b` query param only (no middleware, no cookies).
- Rewrite 20 editPrompts into short 한글 반말 one-liners; use them in BOTH A (evolution chat bubbles) and B (rotating headline).

## Tasks
- [x] Add `caption` field (한글 반말 one-liner) to each version in `src/lib/logo-evolution.json` (v1 = "로고 하나 만들어줘", v2-v20 = distilled from editPrompt).
- [x] Update `logo-evolution.tsx` to render `caption` instead of raw `prompt`/`editPrompt`.
- [x] Create `src/components/landing-page-b.tsx` — copy-driven variant.
- [x] Update `(public)/page.tsx` to accept `searchParams`, read `?v=b`, render B or A.
- [x] Build passes.

## Non-goals
- No middleware cookie split (future).
- No analytics wiring (future).
- No SEO divergence (same metadata for now).

## B layout (copy-driven)
- Hero: small "AI 로고 디자인" eyebrow
- Big headline with rotating active caption (crossfade/slide) — cycles the 20 captions
- Sub: "이렇게 한 마디씩 던지면, 로고가 완성돼."
- Right/center: v20 logo large, static
- CTA: 무료로 시작하기 + 보조링크 (→ A 버전 데모 보기: `/?v=a`)
- Below: 기존 How It Works / Features / Pricing / Final CTA 재사용 (LandingPage에서 import)
