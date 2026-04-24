# Splash — AI Logo Design SaaS

## What is this?

AI 채팅 기반 로고 디자인 SaaS. 사용자가 AI와 대화하며 로고를 생성하고 편집하는 2패널 웹앱.
- **좌측**: AI 채팅 (인터뷰 → 생성 → 수정)
- **우측**: 갤러리 (로고 카드, 버전 관리, 내보내기)
- **도메인**: https://usesplash.vercel.app

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| API Layer | tRPC v11 |
| Database | PostgreSQL (Neon) via Prisma 7 |
| Auth | NextAuth v5 (Google OAuth) |
| Storage | Vercel Blob |
| Chat/AI | Vercel AI SDK v6 + OpenRouter |
| Image Gen | Google Gemini API (`@google/genai`) |
| Package Manager | pnpm |

## Project Structure

```
/                           # Repo root (Next.js app + docs)
├── src/
│   ├── app/                  # App Router pages + API routes
│   │   ├── api/chat/         # AI chat streaming endpoint
│   │   ├── api/trpc/         # tRPC handler
│   │   ├── projects/         # Dashboard + workspace
│   │   └── login/            # Google OAuth
│   ├── components/           # React components (chat-panel, gallery-panel, …)
│   ├── lib/
│   │   ├── gemini.ts         # Gemini image gen (retry + concurrency limiter)
│   │   ├── storage.ts        # Vercel Blob upload
│   │   ├── auth.ts           # NextAuth config
│   │   ├── prisma.ts         # PrismaClient + PrismaPg adapter
│   │   ├── chat/             # hooks, system-prompt, composer-store, …
│   │   └── trpc/             # tRPC client/server setup
│   └── server/routers/       # project, logo, chat, generation, export, subscription
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── prisma.config.ts          # Prisma 7 config (required)
├── .env / .env.local         # Local env (gitignored)
├── .agents/skills/           # AI agent skills (CLI reference)
├── openspec/                 # OpenSpec change tracking
└── .skill-archive/           # Generated logo archives
```

## Accounts & Deployment

### GitHub
- **Repo**: `mainsoft-2024/usesplash` (https://github.com/mainsoft-2024/usesplash)
- **Org**: `mainsoft-2024` (NOT `paulp-o`)
- **Switch**: `gh auth switch --user mainsoft-2024` before push

### Vercel
- **Account**: `mainsoft2024`
- **Project**: Connected to GitHub repo
- **Deploy**: `npx vercel --prod` from repo root
- **NOTE**: Auto-deploy on push may not work — use manual deploy

### Neon (PostgreSQL)
- **Region**: ap-southeast-1 (Singapore)
- **Important**: `sslmode=require` only. Do NOT use `channel_binding=require` (Prisma fails)

## Environment Variables

All must be set in both `.env` (local) and Vercel dashboard (production):

| Variable | Source | Required |
|----------|--------|----------|
| `DATABASE_URL` | Neon dashboard | Yes |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Yes |
| `NEXTAUTH_URL` | `http://localhost:3000` (local) / omit on Vercel | Local only |
| `GOOGLE_CLIENT_ID` | Google Cloud Console | Yes |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | Yes |
| `OPENROUTER_API_KEY` | openrouter.ai | Yes |
| `OPENROUTER_MODEL` | Default: `google/gemini-3-flash-preview` | Yes |
| `GEMINI_API_KEY` | Google AI Studio | Yes |
| `BLOB_READ_WRITE_TOKEN` | Vercel dashboard → Storage → Blob | Yes |
| `REMOVE_BG_API_KEY` | remove.bg | Optional (export) |
| `RECRAFT_API_KEY` | recraft.ai | Optional (SVG export) |

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

### Database

```bash
npx prisma migrate dev          # Apply migrations
npx prisma generate             # Regenerate client (auto in build)
npx prisma studio               # GUI browser
```

Prisma 7 requires `prisma.config.ts` at repo root — do NOT delete it.

### Build & Deploy

```bash
pnpm build                      # TypeScript check + Next.js build
npx vercel --prod               # Deploy to production
```

## Architecture Decisions

### Prisma 7 (not 6)
- Client generator: `prisma-client` (not `prisma-client-js`)
- Output: `src/generated/prisma/`
- Requires `PrismaPg` adapter in `prisma.ts`
- `url = env()` syntax removed — use `prisma.config.ts` instead

### AI SDK v6 (parts-based messages)
- Messages use `parts[]` array, not `content` string
- Tool parts: `tool-generate_batch`, `tool-edit_logo` (typed by tool name)
- Tool states: `input-available` → `input-streaming` → `output-available` / `output-error`
- `useChat` returns `sendMessage({ text })`, NOT `append()`
- `messages` prop is initial-only; use `setMessages()` for async updates

### Chat Persistence
- `ChatMessage` model has `parts Json?` field for full message structure
- `onFinish` uses `steps[]` array to reconstruct parts (not `response.messages`)
- `convertToModelMessages(messages, { ignoreIncompleteToolCalls: true })` required
- `consumeStream` passed to `toUIMessageStreamResponse` for abort safety

### Gemini Image Generation
- Model: `gemini-3-pro-image-preview` (nanobanana compatible)
- Config: `responseModalities: ["IMAGE", "TEXT"]` — TEXT required for stability
- Concurrency: Max 2 parallel requests (Tier 1 rate limit: 10 IPM)
- Retry: Exponential backoff on 429/503 (2s → 4s → 8s, max 3 retries)
- `gemini.ts` exports `withGeminiConcurrency()` for callers

### Auth
- NextAuth v5 with Google OAuth
- Middleware does cookie check only — actual auth via `auth()` in page layouts
- JWT strategy (not database sessions)

### OpenRouter
- Provider: `createOpenRouter()` with `compatibility: "compatible"`
- Custom model via `openrouter(modelId)`, NOT `openrouter.chat(modelId)`
- Default model: `google/gemini-3-flash-preview`

### Logo mentions
- `data-mention` parts live inside `ChatMessage.parts` JSON — no DB migration; each carries `{ logoId, versionId, orderIndex, versionNumber, imageUrl }`
- Cap 3 mentions per message, deduped by `versionId`; enforced client-side via `composerStore` (Zustand) and server-side via `validateMentions` (cross-project rejected with `400 mention_invalid`)
- Composer state lives in `src/lib/chat/composer-store.ts`; history-chip → gallery highlight via `src/lib/chat/gallery-spotlight-store.ts`; `<Toaster />` (sonner) mounted in `providers.tsx` for the cap toast
- Gallery version cards expose a hover `@ 인용` button that pushes a chip into the active project's composer; disabled when the composer's `activeProjectId` differs
- `edit_logo` tool gained `referencedVersions: string[] (≤3)` + `outputMode: "new_version" | "new_logo"`; server appends validated mention `imageUrl`s as `file` parts on the user message so the LLM sees the actual images

## Known Issues / Gotchas

1. **Korean IME**: `onKeyDown` must check `e.nativeEvent.isComposing` to avoid double-submit
2. **Vercel Blob**: Token name is `BLOB_READ_WRITE_TOKEN` (auto-set if linked via Vercel dashboard)
3. **Prisma on Neon**: Remove `channel_binding=require` from DATABASE_URL if connection fails
4. **System prompt backticks**: The system prompt is a JS template literal — do NOT use backticks inside it
5. **`maxDuration`**: Set to 300s in chat route for 5-image batch generation with retries
6. **`stepCountIs(3)`**: Limits LLM to 3 reasoning steps (tool call → result → response)
