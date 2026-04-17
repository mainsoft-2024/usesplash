# New Pages Specs

## 1. Pricing Page (`/pricing`)
- **Layout**: Hero text ("당신에게 맞는 요금제를 선택하세요") followed by a 3-column pricing card grid.
- **Cards**:
  - Free, Pro, Enterprise.
  - Pro is highlighted (Border `--accent-green`).
  - List of features with checkmarks.
- **Feature Table**: A detailed comparison table below the cards for power users.
- **FAQ Section**: Accordion style, specifically for billing questions.

## 2. About Page (`/about`)
- **Layout**: Narrative-driven single column.
- **Content**: 
  - "왜 Splash를 만들었는가?" (Story)
  - Focus on the democratization of design through AI.
  - Clean typography, large pull quotes.

## 3. FAQ Page (`/faq`)
- **Layout**: Two columns on desktop. Left = Categories (Sticky), Right = Accordion Q&A.
- **Categories**: 일반, 요금제, 로고 생성, 계정.
- **Interaction**: Accordion expands with a smooth animation, revealing text (`--text-secondary`).

## 4. Terms & Privacy (`/terms`)
- **Layout**: Document style. Narrow max-width (e.g., 65ch) for optimal reading.
- **Navigation**: Tabs at the top to switch between "이용약관" (Terms) and "개인정보처리방침" (Privacy).
- **Typography**: Heavy use of H2, H3, and standard body text. Ordered lists for clauses.
