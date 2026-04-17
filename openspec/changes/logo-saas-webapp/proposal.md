## Why

기존 CLI 기반 로고 생성 스킬(logo-creator + nanobanana)을 SaaS 웹 애플리케이션으로 전환한다. 현재 로고 생성 워크플로우는 CLI에서 에이전트가 직접 스크립트를 실행하는 방식으로, 일반 사용자가 접근할 수 없다. 이를 AI 채팅 기반 웹앱으로 만들어 누구나 대화로 로고를 디자인하고, 수정/버전관리/내보내기까지 셀프서비스로 할 수 있게 한다.

## What Changes

- **신규 웹앱**: Next.js App Router + tRPC + Prisma + PostgreSQL 기반 풀스택 SaaS
- **AI 채팅 인터페이스**: 좌측 채팅 패널에서 AI가 브랜드/스타일/색상/비율을 인터뷰하고, 수정 요청을 자연어로 받아 처리
- **이미지 생성**: 기존 nanobanana 스킬(Gemini 3 Pro Image)을 백엔드 서비스로 래핑 — 배치 생성 + 개별 편집
- **갤러리 UI**: 우측 패널에 카드 기반 갤러리. 원본+수정본 묶음, ↑↓로 버전 전환, ←→로 로고 이동, REV 뱃지/버전 도트
- **버전 관리**: 수정본이 버전으로 쌓이며, 특정 버전에서 분기 가능 ("v4 기반으로 해줘")
- **내보내기**: 크롭(crop_logo.py), 배경제거(remove_bg.py), SVG 변환(vectorize.py) 기능을 웹 API로 제공
- **프로젝트 관리**: 사용자별 프로젝트 폴더 분리, 프로젝트 목록/상세 관리
- **인증**: NextAuth 기반 소셜 로그인 (Google, GitHub)
- **구독/요금제**: 요금제 모델(Free/Pro/Enterprise) 관리 UI 및 DB 구조 구현. 실제 결제 연동은 제외하고 관리자가 수동으로 구독 변경
- **LLM 백엔드**: OpenRouter 연동으로 다양한 모델 선택 가능
- **이미지 저장소**: AWS S3 + CloudFront
- **기존 스킬 동봉**: .agents/skills/logo-creator, .agents/skills/nanobanana 를 프로젝트에 포함

## Capabilities

### New Capabilities
- `ai-chat-engine`: AI 채팅 엔진 — OpenRouter 연동 LLM 대화, 인터뷰 플로우, 수정 요청 해석, 이미지 생성/편집 명령 변환
- `image-generation`: 이미지 생성/편집 서비스 — Gemini API를 통한 배치 생성, 이미지 편집(수정), 크롭/배경제거/SVG 변환
- `gallery-ui`: 갤러리 UI — 2패널 레이아웃(채팅+갤러리), 카드 그룹, 버전 전환(↑↓), 로고 이동(←→), REV 뱃지, 버전 도트
- `version-management`: 버전 관리 — 수정본 스택, 분기(fork from version), 버전 트리 추적
- `export-pipeline`: 내보내기 파이프라인 — 크롭, 배경제거, SVG 변환, 다운로드
- `project-management`: 프로젝트 관리 — CRUD, 사용자별 프로젝트 격리, 프로젝트 목록
- `auth`: 인증 — NextAuth, Google/GitHub OAuth, 세션 관리
- `subscription`: 구독/요금제 — 요금제 모델, 사용량 제한, 관리자 수동 구독 변경 UI
- `storage`: 스토리지 — S3 업로드/다운로드, CloudFront CDN, presigned URL

### Modified Capabilities
<!-- 기존 스펙 없음 (새 프로젝트) -->

## Impact

- **새 프로젝트 구조**: Next.js 앱 전체 scaffolding 필요
- **외부 API 의존성**: OpenRouter (LLM), Gemini API (이미지 생성), remove.bg (배경제거), Recraft (SVG 변환), AWS S3
- **기존 Python 스크립트**: generate.py, batch_generate.py, crop_logo.py, remove_bg.py, vectorize.py → 백엔드 API route에서 호출하거나 TypeScript로 포팅
- **DB 스키마**: User, Project, Logo, LogoVersion, Subscription, ChatMessage 테이블 신규
- **인프라**: PostgreSQL DB, S3 버킷, CloudFront 배포 필요