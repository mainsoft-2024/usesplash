## Context

현재 채팅에서 첨부된 이미지는 base64 data URL로 DB에 저장되고 UI에 표시만 된다. LLM(OpenRouter `google/gemini-3-flash-preview`)은 비전을 지원하지만, 현재 메시지 변환 시 이미지 파트가 LLM에 전달되지 않는다. `edit_logo` tool은 Gemini에 이미지를 전달하지만, `generate_batch`는 텍스트만 전달한다.

## Goals / Non-Goals

**Goals:**
- 사용자 첨부 이미지를 LLM이 시각적으로 인식하여 자동 분석 응답 제공
- 첨부 이미지를 Vercel Blob에 업로드하고 512px 리사이즈하여 토큰 비용 최적화
- `generate_batch`에 레퍼런스 이미지 전달 기능 추가
- `view_logo` tool로 LLM이 갤러리 로고를 필요 시 시각적으로 참조
- 대화 턴당 최대 5장 이미지 안전장치

**Non-Goals:**
- 이미지 외 파일 타입 지원 (PDF, 문서 등)
- 클라이언트 측 리사이즈 (서버에서 처리)
- 이미지 캐싱/CDN 최적화 (후속 작업)
- 드래그&드롭 첨부 UI

## Decisions

### D1: 첨부 이미지 저장 — Vercel Blob
- **선택**: 첨부 이미지를 서버에서 리사이즈 후 Vercel Blob에 업로드, Blob URL을 DB에 저장
- **대안**: base64 data URL 유지 → DB 비대화, 토큰 비용 궉장, 성능 저하
- **근거**: Blob URL은 LLM에 `image_url`로 직접 전달 가능하고, DB 크기를 줄이며, 기존 로고 업로드 인프라(`lib/storage.ts`)를 재사용

### D2: 리사이즈 — sharp, 512px
- **선택**: `sharp` 라이브러리로 긴 변 512px 리사이즈, WebP 출력
- **대안**: canvas(jimp) → 느림, 블로블리한 API
- **근거**: sharp는 Node.js 이미지 처리 표준, Vercel에서 동작 확인됨. 512px은 비전 분석에 충분하면서 토큰 절약

### D3: LLM 비전 전달 — OpenRouter `image_url` 포맷
- **선택**: 메시지 변환 시 file 파트를 OpenRouter의 `content[].type: "image_url"` 포맷으로 변환
- **근거**: OpenRouter는 Gemini Flash에 이미지 입력을 지원. Blob URL을 직접 전달하므로 base64 변환 불필요

### D4: 갤러리 로고 접근 — `view_logo` tool
- **선택**: LLM이 호출하는 `view_logo` tool을 추가. 로고 인덱스+버전을 받아 Blob URL과 메타데이터를 반환. tool result에 `image_url`로 포함하여 LLM이 시각적으로 인식
- **대안**: 매 턴 모든 로고 이미지 전달 → 토큰 폭발
- **근거**: tool 기반이면 LLM이 필요한 로고만 선택적으로 확인하므로 토큰 효율적

### D5: 레퍼런스 이미지 전달 — LLM 판단
- **선택**: `generate_batch` tool에 `referenceImageUrls: string[]` 파라미터 추가. LLM이 첨부/갤러리 이미지 중 적절한 것을 선별하여 URL 전달
- **근거**: LLM이 대화 맥락을 이해하고 있으므로 가장 적합한 레퍼런스를 선택 가능

### D6: 이미지 수 안전장치
- 대화 턴당 LLM에 전달되는 이미지 최대 5장
- 시스템 프롬프트에 제한 안내 포함
- 초과 시 가장 최근 이미지 5장만 유지

## Risks / Trade-offs

- **[Vercel Blob 비용]** → 첨부 이미지가 많아지면 저장 비용 증가. 512px 리사이즈로 완화
- **[하위호환]** → 기존 base64 file 파트가 있는 메시지를 Blob URL로 마이그레이션해야 함. 파싱 시 양쪽 다 지원하도록 처리
- **[sharp on Vercel]** → Vercel Serverless에서 sharp는 동작하지만, edge runtime에서는 불가. chat route는 Node runtime이므로 문제 없음
- **[LLM 토큰 비용]** → 이미지 5장 제한 + 512px 리사이즈로 완화. 향후 이미지 캐싱으로 추가 최적화 가능