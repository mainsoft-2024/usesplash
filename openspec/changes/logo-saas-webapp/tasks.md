## 1. Project Scaffolding

- [x] 1.1 Initialize Next.js 15 App Router project with TypeScript
- [x] 1.2 Install and configure tRPC v11 with App Router integration
- [x] 1.3 Install and configure Prisma with PostgreSQL
- [x] 1.4 Set up Tailwind CSS and base layout (dark theme)
- [x] 1.5 Configure environment variables (.env.example with all required keys)
- [x] 1.6 Copy .agents/skills/logo-creator and .agents/skills/nanobanana into project

## 2. Database Schema

- [x] 2.1 Create Prisma schema: User, Account, Session (NextAuth)
- [x] 2.2 Create Prisma schema: Project (name, description, userId, timestamps)
- [x] 2.3 Create Prisma schema: Logo (projectId, orderIndex, prompt, aspectRatio)
- [x] 2.4 Create Prisma schema: LogoVersion (logoId, versionNumber, parentVersionId, imageUrl, editPrompt, s3Key)
- [x] 2.5 Create Prisma schema: ChatMessage (projectId, role, content, logoId?, logoVersionId?)
- [x] 2.6 Create Prisma schema: Subscription (userId, tier, dailyGenerations, resetAt)
- [x] 2.7 Run initial migration and seed script

## 3. Authentication

- [x] 3.1 Set up NextAuth v5 with Prisma adapter
- [x] 3.2 Configure Google OAuth provider
- [x] 3.3 Configure GitHub OAuth provider
- [x] 3.4 Create login page UI
- [x] 3.5 Add middleware for protected routes (redirect to /login)
- [x] 3.6 Create user session hook and context

## 4. Storage Layer (S3)

- [x] 4.1 Install AWS SDK v3 (@aws-sdk/client-s3, @aws-sdk/cloudfront-signer)
- [x] 4.2 Create S3 service module (upload, download, presignedUrl, delete)
- [x] 4.3 Configure S3 bucket key structure (users/{userId}/projects/...)
- [x] 4.4 Create CloudFront URL helper for image serving

## 5. tRPC Router Setup

- [x] 5.1 Create tRPC context with session
- [x] 5.2 Create project router (create, list, get, update, delete)
- [x] 5.3 Create logo router (list by project, get with versions)
- [x] 5.4 Create logoVersion router (create, get, list tree)
- [x] 5.5 Create chat router (list messages, create message)
- [x] 5.6 Create export router (crop, removeBg, vectorize, download)
- [x] 5.7 Create subscription router (get current, admin update)
- [x] 5.8 Create generation router (generate batch, edit single)

## 6. Image Generation Service

- [x] 6.1 Create Gemini API TypeScript client (@google/genai SDK)
- [x] 6.2 Implement generateLogo function (text prompt → image buffer)
- [x] 6.3 Implement editLogo function (source image + prompt → edited image buffer)
- [x] 6.4 Implement batchGenerate with sequential execution and delay
- [x] 6.5 Wire generation to S3 upload and DB record creation
- [x] 6.6 Add rate limit handling and retry logic

## 7. AI Chat Engine

- [x] 7.1 Install Vercel AI SDK (ai package) and OpenRouter provider
- [x] 7.2 Create system prompt with interview flow scenario (brand/style/color/ratio)
- [x] 7.3 Create chat API route with streaming (POST /api/chat)
- [x] 7.4 Implement tool calls: generate_batch, edit_logo, select_version
- [x] 7.5 Parse modification requests (logo number + edit description)
- [x] 7.6 Persist chat messages to DB via tRPC
- [x] 7.7 Add OpenRouter model configuration (admin-configurable)

## 8. Project Management UI

- [x] 8.1 Create project dashboard page (/projects) with project cards
- [x] 8.2 Create new project dialog/modal
- [x] 8.3 Create project deletion with confirmation
- [x] 8.4 Add project card: name, description, date, logo count, revision count

## 9. Gallery UI

- [x] 9.1 Create two-panel layout component (resizable splitter)
- [x] 9.2 Create chat panel component (message list, input, streaming display)
- [x] 9.3 Create gallery panel with card grid
- [x] 9.4 Create card group component (original + revisions, version dots, REV badge)
- [x] 9.5 Implement ↑↓ version switching on cards
- [x] 9.6 Create modal/lightbox view with full-size image
- [x] 9.7 Implement keyboard navigation in modal (←→ logos, ↑↓ versions, Esc close)
- [x] 9.8 Add version dot indicators and ORIGINAL/REV pills
- [x] 9.9 Add favorites functionality
- [x] 9.10 Real-time gallery update as images generate

## 10. Export Pipeline

- [x] 10.1 Install Sharp for Node.js image processing
- [x] 10.2 Implement crop endpoint (Sharp: trim whitespace, center in 1:1)
- [x] 10.3 Implement background removal endpoint (remove.bg API call)
- [x] 10.4 Implement SVG vectorization endpoint (Recraft API call)
- [x] 10.5 Create export UI (crop/removeBg/SVG buttons on selected version)
- [x] 10.6 Implement presigned URL download flow

## 11. Subscription & Usage Limits

- [x] 11.1 Create subscription tier constants (Free/Pro/Enterprise limits)
- [x] 11.2 Create usage tracking middleware (check daily generation count)
- [x] 11.3 Create admin page for manual subscription management
- [x] 11.4 Add upgrade prompts when limits reached
- [x] 11.5 Implement daily counter reset logic

## 12. Integration & Polish

- [x] 12.1 Wire chat actions to gallery updates (generate → gallery refresh)
- [x] 12.2 Add loading states and progress indicators for generation
- [x] 12.3 Add error handling and user-friendly error messages throughout
- [x] 12.4 Add responsive layout handling
- [x] 12.5 Test full flow: login → create project → interview → generate → modify → export