---
created: 2026-04-24T17:10:00+09:00
last_updated: 2026-04-24T17:10:00+09:00
type: spec
change_id: manual-area-crop
status: pending
trigger: "사용자가 영역을 직접 선택해서 크롭하는 기능 추가 요청"
---

# Interview Summary: Manual Area-Selection Cropping

## Research Documents Referenced
- `.slash/workspace/research/spec-manual-crop-library-comparison.md` — React crop library comparison (react-image-crop v11 recommended)
- `.slash/workspace/research/spec-manual-crop-sharp-patterns.md` — Server-side sharp.extract() patterns, validation, padding
- `.slash/workspace/research/spec-manual-crop-ux-patterns.md` — UX patterns from Canva, Figma, Photoshop, Google Photos, iOS Photos, Instagram

---

## Interview Transcript (27 questions, 5 rounds)

### Round 1 — Scope & UX Shape (6 questions)

**Q1. 크롭 진입점 (Entry Point)**
> 현재 갤러리 모달에 '크롭' 버튼이 하나 있어요. 새 수동 크롭 기능의 진입점을 어떻게 구성할까요?
- **Answer**: 하나의 '크롭' 버튼 → 탭 모달 (자동 크롭 + 영역 크롭)
- 기존 버튼 하나로 탭 모달을 열어 자동(whitespace trim)과 수동(영역 선택) 두 가지를 제공

**Q2. 비율 프리셋 (Aspect Ratio Presets)**
> 수동 크롭에서 제공할 종횡비 프리셋을 골라주세요.
- **Answer**: 1:1 · 4:5 · 16:9 · 자유
- 로고 SaaS에 가장 실용적인 4개 프리셋

**Q3. 크롭 모달 열릴 때 기본 상태**
> 수동 크롭 모달이 열릴 때, 선택 영역의 초기 상태는?
- **Answer**: 이미지 중앙 80% 크기로 1:1 정사각 선택 영역 미리 표시
- 가이드형 시작. 사용자가 바로 미세조정만 하면 됨

**Q4. 그리드 오버레이 (Composition Guide)**
> 크롭 영역 위에 삼등분 그리드를 표시할까요?
- **Answer**: 항상 표시
- 대부분의 크롭 도구(Canva, Figma, Photoshop)가 기본 표시

**Q5. 크롭 적용 후 결과 처리**
> 사용자가 영역을 선택하고 '적용'을 누른 후 결과물을 어떻게 처리할까요?
- **Answer**: 갤러리에 새 버전으로 저장 (first-class artifact)
- 크롭 결과가 해당 로고의 새 버전으로 갤러리에 추가됨. 버전 관리 + 되돌리기 가능

**Q6. 탭 구성 — 자동 크롭 탭 동작**
> '자동 크롭' 탭의 동작은 현재와 동일하게(원클릭) 유지할까요? 미리보기를 추가할까요?
- **Answer**: 자동 크롭도 미리보기 추가
- 자동 trim 결과를 먼저 보여주고 확인/취소 선택. 수동 탭과 UX 일관성 유지

### Round 2 — Server Output & Data Model (6 questions)

**Q7. 출력 프레이밍 (Output Framing)**
> 수동 크롭 결과도 자동 크롭처럼 정사각 + 6% 패딩으로 감쌀까요?
- **Answer**: 사용자가 선택한 영역 그대로 추출 (as-is, 패딩 없음)
- 사용자가 의도한 정확한 영역을 반환. 비율이 자유일 때 정사각 강제하지 않음

**Q8. 투명 PNG 처리 (Transparent Sources)**
> 투명 배경 PNG를 크롭할 때 알파 채널 처리는?
- **Answer**: 알파(투명도) 유지
- 투명 배경이 있는 로고는 투명 상태로 크롭

**Q9. Blob 저장소 키 전략 (Storage Key)**
> 실제 Blob 저장소 키를 어떻게 만들까요?
- **Answer**: 새 LogoVersion 레코드 생성 → ${newVersionId}.png
- 기존 버전 시스템과 동일. 크롭 결과가 독립 버전이므로 자체 ID로 저장

**Q10. 크롭 횟수 제한 (Rate Limiting)**
> 수동 크롭 횟수 제한을 둘까요?
- **Answer**: 제한 없음 (v1)
- CPU-only라 비용 문제 없음. 필요시 나중에 추가

**Q11. UsageLog 기록 (Analytics)**
> 크롭 사용을 UsageLog에 기록할까요?
- **Answer**: 기록하기 (type='manual_crop', cost=0)
- 비용 0이지만 기능 사용 통계 추적 가능

**Q12. 크롭 영역 정보 저장**
> 크롭한 영역 정보(x, y, width, height)를 새 LogoVersion에 메타데이터로 저장할까요?
- **Answer**: 저장하기 (LogoVersion.metadata JSON에 cropRect 포함)
- 향후 'undo' 또는 '또같이 잘라줘' 기능의 기반

### Round 3 — AI Integration, Mobile, Accessibility (7 questions)

**Q13. AI 채팅 연동 (Chat Integration)**
> AI 채팅에서 '크롭해줘'라고 하면 어떻게 동작해야 할까요?
- **Answer**: AI 크롭 기능 없음 (자동/수동 모두 UI전용)
- 채팅에서는 크롭 관련 안내만 하고, 실제 동작은 모두 갤러리 UI에서

**Q14. 시스템 프롬프트 dead reference 수정**
> 시스템 프롬프트에 '크롭해줘 → crop whitespace'가 실제 tool 없이 적혀있어요.
- **Answer**: dead reference 삭제만 (크롭은 UI전용)
- 시스템 프롬프트에서 크롭 언급 제거

**Q15. 모바일 지원 우선순위**
> 크롭 모달의 모바일 지원 범위를 어떻게 할까요?
- **Answer**: 데스크톱 우선 + 모바일 기본 터치 지원
- react-image-crop은 기본 터치 지원. 핑치 줄 등 모바일 최적화는 v2에서

**Q16. 키보드 단축키 (Crop Modal)**
> 크롭 모달 안에서 지원할 키보드 단축키는?
- **Answer**: Enter=적용, Esc=취소
- 최소한의 필수 단축키

**Q17. 접근성: 스크린 리더 (Accessibility)**
> 크롭 영역 변경시 스크린 리더 안내를 구현할까요?
- **Answer**: v1에서는 생략, nice-to-have로 기록
- 크롭은 시각적 도구라 스크린리더 우선순위 낮음

**Q18. 크롭 모달 디자인 — 이미지 크기 제한**
> 크롭 모달의 이미지 표시 영역 크기를 어떻게 할까요?
- **Answer**: 현재 갤러리 모달과 동일한 크기 (max-w-[85vw] max-h-[55vh])
- 일관된 UX. 나머지 공간에 프리셋 버튼 + 적용/취소 버튼 배치

**Q19. AI integration detail (selected "no AI crop" — no follow-up needed)**
> (Covered by Q13 — AI will not trigger crop at all)

### Round 4 — Edge Cases & UI Details (5 questions)

**Q20. 크롭 버전 표시 레이블**
> 크롭으로 생성된 새 LogoVersion을 갤러리에서 어떻게 구분할까요?
- **Answer**: 버전 카드에 '✂️ 크롭' 배지 표시
- 작은 비주얼 배지로 크롭으로 만들어진 버전임을 표시

**Q21. 자동 크롭 탭 → 결과 처리**
> 자동 크롭 결과도 수동과 동일하게 새 버전으로 저장할까요?
- **Answer**: 네, 자동 크롭도 새 버전으로 저장
- 수동과 동일한 UX. 자동 크롭 결과도 갤러리에 버전으로 남음

**Q22. 크롭 모달 위치 (UI flow)**
> 크롭 탭 모달은 어디에 렌더링될까요?
- **Answer**: 갤러리 모달 내부 교체 (같은 모달 안에서 내용만 바뀜)
- 갤러리 모달의 이미지 + 액션바 영역을 크롭 UI로 교체. 모달 위에 모달 피함

**Q23. 수동 크롭 실시간 크기 표시**
> 크롭 영역을 드래그할 때 현재 선택 영역의 픽셀 크기를 실시간으로 표시할까요?
- **Answer**: 크롭 영역 아래에 작은 레이블로 표시
- '320 × 320px' 같은 실시간 크기 정보

**Q24. 크롭 실패 에러 처리**
> 서버 크롭이 실패했을 때 사용자에게 어떻게 알릴까요?
- **Answer**: 토스트 알림 + 모달 유지
- 에러 토스트를 보여주고 모달은 열어둔 상태. 사용자가 재시도 가능
- 에러 토스트를 보여주고 모달은 열어둔 상태. 사용자가 재시도 가능

### Round 6 — Schema & Preview Implementation (5 questions — final ambiguities)

**Q28. LogoVersion 메타데이터 저장 방식**
> 크롭 정보 (cropRect, sourceVersionId)를 어디에 저장할까요?
- **Answer**: `LogoVersion.metadata Json?` 필드 추가 (새 prisma 마이그레이션 1개)
- 확장성 최우선. 향후 다른 메타도 같은 필드 활용 가능

**Q29. 크롭 버전 구분 방식 (배지 데이터 소스)**
> '✂️ 크롭' 배지를 DB 어떤 값으로 판단할까요?
- **Answer**: `metadata.source === 'crop_manual' | 'crop_auto'` 로 판단
- `source` 필드는 'generate' | 'edit' | 'upload' | 'crop_manual' | 'crop_auto' 중 하나

**Q30. parentVersionId 사용 여부**
> 크롭 결과 버전을 소스 버전과 어떻게 연결할까요?
- **Answer**: `parentVersionId`로 연결 (크롭도 '편집의 일종')
- 기존 VersionTree 렌더 로직 재활용. 갤러리 트리 표시 그대로 동작

**Q31. 자동 크롭 미리보기 구현 방식**
> 자동 크롭 탭 '미리보기'는 어떻게 구현할까요?
- **Answer**: 2단계 mutation — `previewAutoCrop` (미리보기용 임시 이미지 응답) → `commitCrop` (새 LogoVersion 확정)
- 자동·수동 모두 동일한 2단계 UX 적용 권장

**Q32. 같은 소스 버전 재진입 제한**
> 같은 버전에서 수동 크롭을 여러 번 할 수 있나요?
- **Answer**: 무제한. 매번 새 LogoVersion 생성
- Q10 rate limit 없음과 일관
### Round 5 — Final Decisions (3 questions)

**Q25. 크롭 적용 후 네비게이션**
> 크롭 적용 후(새 버전 저장 완료) 사용자를 어디로 보낼까요?
- **Answer**: 새로 생성된 버전을 갤러리 모달에 표시 (자동 이동)
- 크롭 적용 → 갤러리 모달로 복귀 → 새 버전 자동 선택됨

**Q26. 라이브러리 선택 확인**
> react-image-crop v11으로 진행할까요?
- **Answer**: react-image-crop v11 사용
- 12kB, ISC, 자유형+비율고정, 8개 핸들, 삼등분 그리드 내장, 터치 지원

**Q27. 크롭 모달 로딩 상태**
> 크롭 서버 요청 중 로딩 UI를 어떻게 표시할까요?
- **Answer**: 적용 버튼을 스피너로 교체 + 조작 비활성화
- 적용 버튼이 로딩 스피너로 바뀌고, 크롭 영역/프리셋 조작 불가

---

## Final Consolidated Decisions

### Entry Point & Navigation
- **Single "크롭" button** → opens a tabbed modal (replaces gallery modal content in-place)
- **Two tabs**: "자동 크롭" (auto whitespace trim with preview) + "영역 크롭" (manual area selection)
- **Modal renders inside** the existing gallery modal (content swap, not modal-on-modal)
- After applying crop → **auto-navigate** to the new version in gallery modal

### Manual Crop UX
- **Library**: `react-image-crop` v11 (~12kB, ISC license)
- **Aspect presets**: 1:1 · 4:5 · 16:9 · 자유 (pills/buttons)
- **Default on open**: 80% centered, 1:1 square selection pre-drawn
- **Grid overlay**: Always-on rule-of-thirds (built into react-image-crop)
- **Real-time size label**: Show `W × H px` below the crop area during drag
- **Image display**: max-w-[85vw] max-h-[55vh] (same as gallery modal)
- **Keyboard**: Enter = apply, Esc = cancel
- **Mobile**: Desktop-first + basic touch support (react-image-crop pointer events); pinch-zoom deferred to v2

### Auto Crop UX Changes
- **Add preview** before applying (currently instant)
- **Save as new version** (currently download-link only)
- Both tabs produce the same output flow: preview → confirm → new LogoVersion

### Server / Data Model
- **Extraction**: `sharp.extract({left, top, width, height})` with integer coords
- **Output**: As-is (no re-padding, no square enforcement) — user selects exact region
- **Transparency**: Preserve alpha channel
- **Storage**: New LogoVersion record → standard `getStorageKey(...)` → `${newVersionId}.png`
- **Schema change**: Add `metadata Json?` column to `LogoVersion` (new migration)
- **Metadata shape**:
  ```json
  {
    "source": "crop_manual" | "crop_auto",
    "cropRect": { "x": int, "y": int, "width": int, "height": int } | null,
    "sourceVersionId": "<cuid>"
  }
  ```
- **Version linkage**: `parentVersionId` points at source version (reuses existing VersionTree)
- **Validation**: Integer coords, non-negative, bounds (clamp & reject out-of-source), min 10 natural px (W and H)
- **Rate limit**: None for v1 (unlimited re-crop on same source version)
- **UsageLog**: Record `type='manual_crop'` and `type='auto_crop'` with `count=1`, `imageCostUsd=0`
- **Preview flow (both tabs)**: 2-step mutation
  1. `previewAutoCrop` / `previewManualCrop` — server runs sharp → returns a temporary preview URL (or base64) WITHOUT creating a LogoVersion or writing UsageLog
  2. `commitCrop` — takes `{ sourceVersionId, source: 'crop_auto'|'crop_manual', rect? }`, re-runs sharp, uploads to Blob, creates LogoVersion, writes UsageLog

### Gallery Display
- Cropped versions show a **✂️ 크롭 badge** on version cards
- Source field or metadata distinguishes generated/cropped/uploaded versions

### AI Chat Integration
- **No AI crop tool** — crop is UI-only (both auto and manual)
- **Remove dead reference** in system-prompt.ts:62 (`"크롭해줘" → crop whitespace`)
- AI should guide users to the gallery crop button if asked about cropping

### Error Handling & Loading
- **Loading**: Apply button → spinner + disable crop controls
- **Error**: Toast notification + keep modal open (retry possible)

### Accessibility
- **v1**: Basic — keyboard Enter/Esc, focus management on modal open/close
- **Deferred to v2**: Screen reader announcements of crop dimensions (aria-live region)

---

## Open Items / Explicit Non-Goals for v1

### Deferred to v2
- [ ] Pinch-zoom inside crop surface (would require switching to react-easy-crop)
- [ ] Arrow key nudging of crop area (1px/10px with Shift)
- [ ] Screen reader announcements of crop dimensions (aria-live)
- [ ] Advanced mobile UX (responsive crop handle sizing, gesture optimization)
- [ ] Custom numeric input for exact dimensions (e.g., type "512 × 512")
- [ ] Rotation/straighten in crop modal
- [ ] AI-driven crop (LLM specifying crop rect programmatically)

### Non-Goals
- No crop history browser (versions in gallery serve this purpose)
- No rate limiting for v1 (revisit if abuse detected)
- No undo within the crop modal (user can undo by switching back to original version)
- No batch crop (one image at a time)

---

## Affected Specs & Files

### OpenSpec specs to modify
- `openspec/specs/export-pipeline/spec.md` — Update "Crop whitespace" requirement to include manual crop; add auto-crop preview requirement
- `openspec/specs/gallery-ui/spec.md` — Add crop modal UI requirement, version badge requirement

### Key source files to modify
- `src/components/gallery-panel.tsx` — Gallery modal: add crop mode state, tab UI, react-image-crop integration, version badge
- `src/server/routers/export.ts` — Add `manualCrop` mutation with extract + validation; modify existing `crop` for preview + version save
- `src/lib/chat/system-prompt.ts` — Remove dead crop reference (line ~62)
- `prisma/schema.prisma` — Potentially add `metadata Json?` to LogoVersion if not already present
- New component: `src/components/crop-modal.tsx` or inline in gallery-panel

### New dependencies
- `react-image-crop@^11.0.10` — ISC license, ~12kB minzipped
