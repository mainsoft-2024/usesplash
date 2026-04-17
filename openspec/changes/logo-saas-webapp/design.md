## Context

CLI 기반 로고 생성 스킬(logo-creator, nanobanana)을 웹 SaaS로 전환. 기존 Python 스크립트(generate.py, batch_generate.py, crop_logo.py, remove_bg.py, vectorize.py)와 preview.html 갤러리 UI가 PoC로 존재. 이를 상용 SaaS 수준으로 재구성한다.

## Goals / Non-Goals

**Goals:**
- AI 채팅으로 인터뷰 → 배치 생성 → 수정(편집) → 버전관리 → 내보내기 전체 플로우 웹에서 제공
- 좌측 채팅 + 우측 갤러리 2패널 레이아웃
- 버전 분기(fork), 버전 트리, 수정본 스택
- 프로젝트 격리, 요금제 관리(결제 연동 제외)
- OpenRouter로 다양한 LLM 동적 선택

**Non-Goals:**
- 실제 결제 연동 (Stripe 등)
- 다국어/i18n (한국어 우선)
- 모바일 앱 버전
- 실시간 협업 기능

## Decisions

### 1. 프로젝트 구조: 모노리포 Next.js App
- **선택**: Next.js 15 App Router + tRPC v11 + Prisma + PostgreSQL
- **대안**: React+FastAPI 분리 — 기존 Python 스크립트 직접 활용 가능하나, 풀스택 TS로 통일이 더 간결
- **근거**: 타입 세이프 엔드투엔드, SSR/RSC 활용, 단일 리포 관리

### 2. AI 채팅: OpenRouter + Vercel AI SDK
- **선택**: OpenRouter API + Vercel AI SDK(ai) 스트리밍
- **근거**: OpenRouter로 모델 전환 용이, Vercel AI SDK로 스트리밍 채팅 UI 간편 구현
- 인터뷰 플로우는 system prompt에 단계별 질문 시나리오 내장. AI가 요구사항 다 모으면 자동으로 생성 명령 발송

### 3. 이미지 생성: Gemini API 직접 호출 (TypeScript)
- **선택**: @google/genai SDK를 TypeScript에서 직접 호출
- **대안**: Python 스크립트를 subprocess로 호출 — 배포 복잡성 증가, 에러 핸들링 어려움
- **근거**: 풀 TS 통일, 배포 간소화, 에러 핸들링 간편

### 4. 이미지 편집 전략: Gemini의 이미지 입력 + 텍스트 프롬프트
- **선택**: 수정 요청 시 해당 버전 이미지를 Gemini에 input으로 넣고 편집 프롬프트 전송 (재생성 아님)
- 기존 nanobanana의 edit_image 패턴과 동일

### 5. 버전 관리: DB 레코드 + 트리 구조
- Logo 테이블 = 원본, LogoVersion 테이블 = 각 수정본
- LogoVersion에 parentVersionId로 트리 구조 구현 → 분기 가능
- 각 버전에 S3 URL, 프롬프트, 채팅 메시지 참조 저장

### 6. 내보내기: 백엔드 API route에서 처리
- crop: Sharp 라이브러리 (Node.js 네이티브)
- remove_bg: remove.bg API 호출 (HTTP)
- vectorize: Recraft API 호출 (HTTP)
- 결과물 S3에 저장 후 presigned URL로 다운로드 제공

### 7. 스토리지: S3 + CloudFront
- 버킷: `logo-saas-{env}`, 키 구조: `users/{userId}/projects/{projectId}/logos/{logoId}/{versionId}.png`
- 업로드: presigned URL (PUT), 다운로드: CloudFront + presigned GET

### 8. 갤러리 UI: preview.html 레퍼런스 재구현
- 기존 preview.html의 카드 그룹 + ↑↓←→ 키보드 네비게이션 + REV 뱃지 + 버전 도트 패턴을 React 컴포넌트로 구현
- 모달 확대/풍스크린 뷰, 즐겨찾기, 다운로드 버튼

### 9. 인증: NextAuth v5
- Google, GitHub OAuth provider
- JWT 전략, DB adapter(Prisma)

### 10. 구독/요금제
- Free: 3프로젝트, 10회 생성/일
- Pro: 무제한 프로젝트, 100회 생성/일, 프리미엄 내보내기
- Enterprise: 무제한, 우선 생성, 전용 지원
- 관리자 페이지에서 수동 구독 변경 (DB 업데이트)

## Risks / Trade-offs

- [Gemini API 레이트 리밋] → 요청 큐잉/리트라이 로직 구현, 배치 생성 시 순차 처리 + delay
- [S3 비용] → 이미지 사이즈 제한, 오래된 미사용 프로젝트 자동 삭제 정책 고려
- [OpenRouter 의존성] → 장애 시 사용자에게 명확한 에러 표시, 로컬 LLM fallback 고려 가능
- [Python 스크립트 포팅 비용] → TypeScript 네이티브(Sharp) + HTTP API 직접 호출로 최소화
- [무료 티어 남용] → IP + 세션 기반 요청 제한, 등급별 일일 생성 횟수 제한