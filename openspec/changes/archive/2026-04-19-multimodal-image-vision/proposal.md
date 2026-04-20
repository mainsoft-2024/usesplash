## Why

사용자가 채팅에 이미지를 첨부할 수 있지만, LLM이 이미지를 인식하지 못해 저장/표시만 된다. "이 느낌으로 만들어줘"처럼 레퍼런스 기반 로고 생성이 불가능하고, AI가 첨부 이미지를 분석·설명하지 못한다. 기존 갤러리 로고도 LLM이 시각적으로 참조할 수 없어 수정 지시 시 맥락이 단절된다.

## What Changes

- LLM(OpenRouter Gemini Flash)에 사용자 첨부 이미지를 `image_url` 타입으로 전달하여 비전 분석 활성화
- 첨부 이미지를 서버에서 sharp로 512px 리사이즈 후 Vercel Blob에 업로드 (기존 base64 DB 저장 → URL 참조로 전환)
- `generate_batch` tool에 `referenceImageUrls` 파라미터 추가, LLM이 판단하여 레퍼런스 이미지 선별 전달
- `view_logo` tool 신규 추가 — LLM이 갤러리 로고를 필요 시 가져와 시각적으로 분석
- 시스템 프롬프트에 이미지 분석 지침 추가 (자동 분석 응답, 최대 5장 제한 안내)
- 대화 턴당 LLM에 전달되는 이미지 최대 5장 안전장치

## Capabilities

### New Capabilities
- `image-vision`: LLM의 멀티모달 비전 기능 — 첨부 이미지 분석, 자동 코멘트, 레퍼런스 기반 생성
- `attachment-storage`: 첨부 이미지의 서버 리사이즈(512px) 및 Vercel Blob 업로드 파이프라인

### Modified Capabilities
- `ai-chat-engine`: 시스템 프롬프트에 이미지 분석 지침 추가, 메시지 변환 시 이미지 파트를 OpenRouter 비전 포맷으로 전달
- `image-generation`: `generate_batch` tool에 `referenceImageUrls` 파라미터 추가, `generateLogoImage`에 레퍼런스 이미지 입력 지원

## Impact

- **API route** (`api/chat/route.ts`): 메시지 변환 로직 수정, `view_logo` tool 추가, `generate_batch` 스키마 확장
- **Gemini 모듈** (`lib/gemini.ts`): `generateLogoImage`에 레퍼런스 이미지 입력 추가
- **시스템 프롬프트** (`lib/chat/system-prompt.ts`): 비전 분석 지침 추가
- **Chat panel** (`components/chat-panel.tsx`): 첨부 이미지를 Blob URL로 전환하는 업로드 플로우 변경
- **Storage** (`lib/storage.ts`): 리사이즈 + 업로드 함수 추가
- **Dependencies**: `sharp` 패키지 추가
- **DB**: `ChatMessage.parts`의 file 파트가 base64 대신 Blob URL을 저장하도록 변경 (하위호환 필요)