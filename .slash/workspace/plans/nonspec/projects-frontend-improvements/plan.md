---
created: 2026-04-14T00:00:00Z
last_updated: 2026-04-14T00:00:00Z
type: nonspec
change_id: projects-frontend-improvements
status: pending
trigger: "General frontend quality improvements to projects list page and project workspace page — replace hardcoded colors with CSS variables, add accessibility, error states, keyboard support, and extract reusable logic"
---

# Plan: Projects Pages Frontend Improvements

## Background & Research

### CSS Variables Already Defined in globals.css

The project already has a complete set of CSS custom properties in `web/src/app/globals.css` (lines 3-15) that are **not being used** by the projects pages:

```css
:root {
  --bg-primary: #0e0e0e;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #1e1e1e;
  --border-primary: #2a2a2a;
  --border-secondary: #333333;
  --text-primary: #ffffff;
  --text-secondary: #888888;
  --text-tertiary: #666666;
  --accent-green: #4CAF50;
  --accent-green-light: #81c784;
  --accent-orange: #ffb74d;
}
```

### Hardcoded Color → CSS Variable Mapping

| Hardcoded Value | CSS Variable | Used In |
|---|---|---|
| `#0e0e0e` | `var(--bg-primary)` | Input backgrounds, gradient overlays |
| `#0a0a0a` | **(needs new var `--bg-deep`)** | Workspace page bg, header bg |
| `#1a1a1a` | `var(--bg-secondary)` | Modal/card backgrounds, header border |
| `#1e1e1e` | `var(--bg-tertiary)` | — |
| `#1f1f1f` | `var(--bg-tertiary)` (close enough, or new var) | Divider bg |
| `#2a2a2a` | `var(--border-primary)` | Modal/card borders |
| `#333` / `#333333` | `var(--border-secondary)` | Input borders, dividers |
| `#444` | **(needs new var `--text-muted`)** | Empty state text, delete icon |
| `#555` | **(needs new var `--text-dim`)** | Placeholder text, back button, logo count |
| `#666` | `var(--text-tertiary)` | Subtitle text |
| `#888` | `var(--text-secondary)` | Secondary text |
| `#4CAF50` | `var(--accent-green)` | Primary buttons, focus rings, hover borders |
| `#43A047` | **(needs new var `--accent-green-hover`)** | Button hover states |
| `#81c784` | `var(--accent-green-light)` | Logo count badge text |
| `#ffb74d` | `var(--accent-orange)` | Loading indicator |
| `#8888cc` | **(needs new var `--accent-purple`)** | Date badge text |
| `#cccc66` | **(needs new var `--accent-yellow`)** | Revision badge text |
| `#1e1e2e` | **(needs new var `--badge-purple-bg`)** | Date badge bg |
| `#1e2e1e` | **(needs new var `--badge-green-bg`)** | Logo badge bg |
| `#2e2e1e` | **(needs new var `--badge-yellow-bg`)** | Revision badge bg |

### Current projects/page.tsx (177 lines)

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { LoadingScreen } from "@/components/spinners"

export default function ProjectsPage() {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  
  const projects = trpc.project.list.useQuery()
  const createProject = trpc.project.create.useMutation({
    onSuccess: (project) => {
      router.push(`/projects/${project.id}`)
    },
  })
  const deleteProject = trpc.project.delete.useMutation({
    onSuccess: () => projects.refetch(),
  })
  
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/" className="text-3xl font-bold hover:opacity-90">
              Sp<span className="text-[#4CAF50]">lash</span>
            </Link>
            <p className="mt-1 text-sm text-[#666]">AI 로고 디자인 프로젝트</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg bg-[#4CAF50] px-4 py-2 font-medium text-white transition-colors hover:bg-[#43A047]"
          >
            + 새 프로젝트
          </button>
        </div>
        
        {showNew && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setShowNew(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-xl font-bold">새 프로젝트</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (newName.trim()) {
                    createProject.mutate({
                      name: newName.trim(),
                      description: newDesc.trim() || undefined,
                    })
                  }
                }}
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="프로젝트 이름"
                  className="mb-3 w-full rounded-xl border border-[#333] bg-[#0e0e0e] px-4 py-3 text-white placeholder-[#555] focus:border-[#4CAF50] focus:outline-none"
                />
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="설명 (선택)"
                  className="mb-4 w-full rounded-xl border border-[#333] bg-[#0e0e0e] px-4 py-3 text-white placeholder-[#555] focus:border-[#4CAF50] focus:outline-none"
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNew(false)}
                    className="px-4 py-2 text-[#888] hover:text-white"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={!newName.trim() || createProject.isPending}
                    className="rounded-lg bg-[#4CAF50] px-4 py-2 font-medium text-white hover:bg-[#43A047] disabled:opacity-50"
                  >
                    {createProject.isPending ? "생성 중..." : "만들기"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-sm rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
              <h2 className="mb-2 text-lg font-bold">프로젝트 삭제</h2>
              <p className="mb-4 text-sm text-[#888]">
                이 프로젝트와 모든 로고가 삭제됩니다. 되돌릴 수 없습니다.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-[#888] hover:text-white"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    deleteProject.mutate({ id: deleteConfirm })
                    setDeleteConfirm(null)
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}
        
        {projects.isLoading ? (
          <LoadingScreen />
        ) : !projects.data?.length ? (
          <div className="py-20 text-center text-[#444]">
            <p className="mb-2 text-lg">아직 프로젝트가 없습니다</p>
            <p className="text-sm">새 프로젝트를 만들어 로고 디자인을 시작하세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.data.map((project) => (
              <div
                key={project.id}
                className="group relative cursor-pointer rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 transition-all hover:border-[#4CAF50]"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteConfirm(project.id)
                  }}
                  className="absolute right-3 top-3 text-lg text-[#444] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  title="삭제"
                >
                  ×
                </button>
                <h3 className="mb-1 text-lg font-semibold">{project.name}</h3>
                {project.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-[#888]">{project.description}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <span className="rounded-md bg-[#1e1e2e] px-2 py-1 text-xs font-medium text-[#8888cc]">
                    {new Date(project.createdAt).toLocaleDateString("ko")}
                  </span>
                  <span className="rounded-md bg-[#1e2e1e] px-2 py-1 text-xs font-medium text-[#81c784]">
                    {project.logoCount} logos
                  </span>
                  {project.revisionCount > 0 && (
                    <span className="rounded-md bg-[#2e2e1e] px-2 py-1 text-xs font-medium text-[#cccc66]">
                      {project.revisionCount} revisions
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

### Current projects/[id]/page.tsx (215 lines)

```tsx
"use client"

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { UIMessage } from "ai"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { useProjectChat } from "@/lib/chat/hooks"
import { ChatPanel } from "@/components/chat-panel"
import { GalleryPanel } from "@/components/gallery-panel"
import { LoadingScreen } from "@/components/spinners"


export type ToolActivity =
  | { type: "idle" }
  | { type: "generating"; count: number }
  | { type: "editing"; logoIndex: number; versionNumber?: number }
  | { type: "generated"; count: number; generated: number }
  | { type: "edited"; logoIndex: number; versionNumber: number }

export default function ProjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const [splitPos, setSplitPos] = useState(40)
  const dragging = useRef(false)

  const project = trpc.project.get.useQuery({ id: projectId })
  const logos = trpc.logo.listByProject.useQuery({ projectId })
  const chatMessages = trpc.chat.listByProject.useQuery({ projectId })

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!chatMessages.data) return []

    return chatMessages.data.map((msg) => {
      const fallbackParts: UIMessage["parts"] = [{
        type: "text" as const,
        text: msg.content,
      }]

      const rawParts = (msg as { parts?: unknown }).parts
      if (!Array.isArray(rawParts) || rawParts.length === 0) {
        return {
          id: msg.id,
          role: msg.role as "user" | "assistant",
          parts: fallbackParts,
          createdAt: new Date(msg.createdAt),
        }
      }

      const validatedParts = rawParts.flatMap((part): UIMessage["parts"] => {
        if (!part || typeof part !== "object") return []

        const stored = part as Record<string, unknown>
        if (stored.type === "text" && typeof stored.text === "string") {
          return [{ type: "text" as const, text: stored.text }]
        }

        const hasValidToolShape =
          typeof stored.type === "string" &&
          stored.type.startsWith("tool-") &&
          typeof stored.toolCallId === "string" &&
          typeof stored.toolName === "string" &&
          typeof stored.state === "string" &&
          "input" in stored &&
          "output" in stored

        if (!hasValidToolShape) return []

        return [
          {
            type: stored.type,
            toolCallId: stored.toolCallId,
            toolName: stored.toolName,
            state: stored.state,
            input: stored.input,
            output: stored.output,
          } as UIMessage["parts"][number],
        ]
      })

      return {
        id: msg.id,
        role: msg.role as "user" | "assistant",
        parts: validatedParts.length > 0 ? validatedParts : fallbackParts,
        createdAt: new Date(msg.createdAt),
      }
    })
  }, [chatMessages.data])

  const chat = useProjectChat(
    projectId,
    initialMessages,
  )

  const toolActivity = useMemo<ToolActivity>(() => {
    const lastAssistant = [...chat.messages].reverse().find(m => m.role === "assistant")
    if (!lastAssistant?.parts) return { type: "idle" }

    for (const part of lastAssistant.parts) {
      const p = part as any
      if (p.type === "tool-generate_batch") {
        if (p.state === "input-available" || p.state === "input-streaming") {
          return { type: "generating", count: p.input?.count ?? 5 }
        }
        if (p.state === "output-available") {
          return {
            type: "generated",
            count: Number(p.output?.total ?? 0),
            generated: Number(p.output?.generated ?? 0),
          }
        }
      }

      if (p.type === "tool-edit_logo") {
        if (p.state === "input-available" || p.state === "input-streaming") {
          return {
            type: "editing",
            logoIndex: Number(p.input?.logoOrderIndex ?? 0),
            versionNumber: p.input?.versionNumber,
          }
        }
        if (p.state === "output-available") {
          return {
            type: "edited",
            logoIndex: Number(p.output?.logoIndex ?? 0),
            versionNumber: Number(p.output?.versionNumber ?? 0),
          }
        }
      }
    }

    return { type: "idle" }
  }, [chat.messages])

  const prevActivityRef = useRef<string>("idle")

  const handleMouseDown = useCallback(() => { dragging.current = true }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      setSplitPos(Math.max(25, Math.min(75, (e.clientX / window.innerWidth) * 100)))
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  }, [])

  useEffect(() => {
    if (!chat.isLoading) logos.refetch()
  }, [chat.isLoading, chat.messages.length])


  // Poll gallery during AI generation
  useEffect(() => {
    if (!chat.isLoading) return
    const interval = setInterval(() => {
      logos.refetch()
    }, 5000)
    return () => clearInterval(interval)
  }, [chat.isLoading])

  useEffect(() => {
    const curr = toolActivity.type
    const prev = prevActivityRef.current
    if ((prev === "generating" && curr === "generated") || (prev === "editing" && curr === "edited")) {
      logos.refetch()
    }
    prevActivityRef.current = curr
  }, [toolActivity.type, logos])

  if (project.isLoading || chatMessages.isLoading) return <LoadingScreen />

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0a]">
      <div className="h-12 flex items-center justify-between px-4 border-b border-[#1a1a1a] bg-[#0a0a0a] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push("/projects")} className="text-[#555] hover:text-white transition-colors text-sm">
            ← 프로젝트목록
          </button>
          <span className="text-[#333]">|</span>
          <span className="text-sm font-medium truncate max-w-[260px]">{project.data?.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {chat.isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-[#ffb74d]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb74d] animate-pulse" />
              AI 응답 중
            </span>
          )}
          <span className="text-xs text-[#555]">{logos.data?.length ?? 0} logos</span>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div style={{ width: `${splitPos}%` }} className="h-full flex-shrink-0">
          <ChatPanel chat={chat} />
        </div>
        <div className="relative w-1 flex-shrink-0">
          <div className="absolute inset-0 bg-[#1f1f1f] hover:bg-[#4CAF50] cursor-col-resize transition-colors" onMouseDown={handleMouseDown} />
          <div className="pointer-events-none absolute -left-3 top-0 h-full w-3 bg-gradient-to-r from-transparent to-[#0e0e0e]/70" />
          <div className="pointer-events-none absolute left-1 top-0 h-full w-3 bg-gradient-to-r from-[#0e0e0e]/70 to-transparent" />
        </div>
        <div style={{ width: `${100 - splitPos}%` }} className="h-full flex-shrink-0 overflow-hidden">
          <GalleryPanel
            logos={logos.data ?? []}
            isLoading={logos.isLoading}
            projectId={projectId}
            onRefresh={() => logos.refetch()}
            toolActivity={toolActivity}
          />
        </div>
      </div>
    </div>
  )
}
```

### Key Patterns & Constraints

- **Tailwind v4 with CSS-only config** — no `tailwind.config.ts`. Theme extension happens in `globals.css` via `@theme` block (Tailwind v4 pattern) or CSS custom properties.
- **Tailwind v4 arbitrary values**: Currently using `text-[#4CAF50]` etc. These should become `text-[var(--accent-green)]` or Tailwind theme tokens.
- **No component library** — all UI is handcrafted. No shadcn/ui, no Radix, no Headless UI.
- **Korean UI** — All user-facing strings are in Korean. Preserve this.
- **Existing spinners** — `LoadingScreen` component exists and is already used.
- **TRPC + React Query** — mutations use `useMutation` with `onSuccess` callbacks.
- **React 19** — uses `use()` hook for unwrapping params promise (Next.js 16 pattern).

## Testing Plan (TDD — tests first)

> **Note**: No test infrastructure was found in the project. Tests below should be created if a test runner (vitest/jest) is configured. If no test runner exists, skip test tasks and proceed to implementation. The coder should check for `vitest.config` / `jest.config` first.

- [ ] **T1**: Check if test runner exists (`vitest.config.*` or `jest.config.*` in `web/`). If not, skip T2-T5 and proceed directly to implementation.
- [ ] **T2**: Write unit test for `parseInitialMessages` utility — verify it handles: empty array, text-only messages, messages with valid tool parts, messages with invalid parts (falls back), missing `parts` field
- [ ] **T3**: Write unit test for `deriveToolActivity` utility — verify: returns idle when no assistant messages, detects generating state, detects editing state, detects generated/edited completion states
- [ ] **T4**: Write unit test for keyboard handlers — verify: Escape key closes modal, Enter on focused card navigates, keyboard trap within modal
- [ ] **T5**: Write smoke test for projects page rendering — verify: loading state renders LoadingScreen, error state renders error message, empty state renders empty message, populated state renders project cards

## Implementation Plan

### Phase A: Extend CSS Variables (globals.css)

- [ ] **A1**: Add missing CSS custom properties to `:root` in `web/src/app/globals.css`:
  ```css
  --bg-deep: #0a0a0a;
  --text-muted: #444444;
  --text-dim: #555555;
  --accent-green-hover: #43A047;
  --accent-purple: #8888cc;
  --accent-yellow: #cccc66;
  --badge-purple-bg: #1e1e2e;
  --badge-green-bg: #1e2e1e;
  --badge-yellow-bg: #2e2e1e;
  --divider: #1f1f1f;
  ```

### Phase B: Improve projects/page.tsx

- [ ] **B1**: Replace ALL hardcoded hex colors with `var()` references in Tailwind arbitrary values:
  - `text-[#4CAF50]` → `text-[var(--accent-green)]`
  - `text-[#666]` → `text-[var(--text-tertiary)]`
  - `bg-[#4CAF50]` → `bg-[var(--accent-green)]`
  - `hover:bg-[#43A047]` → `hover:bg-[var(--accent-green-hover)]`
  - `border-[#2a2a2a]` → `border-[var(--border-primary)]`
  - `bg-[#1a1a1a]` → `bg-[var(--bg-secondary)]`
  - `border-[#333]` → `border-[var(--border-secondary)]`
  - `bg-[#0e0e0e]` → `bg-[var(--bg-primary)]`
  - `placeholder-[#555]` → `placeholder-[var(--text-dim)]`
  - `focus:border-[#4CAF50]` → `focus:border-[var(--accent-green)]`
  - `text-[#888]` → `text-[var(--text-secondary)]`
  - `text-[#444]` → `text-[var(--text-muted)]`
  - `hover:border-[#4CAF50]` → `hover:border-[var(--accent-green)]`
  - `bg-[#1e1e2e]` → `bg-[var(--badge-purple-bg)]`
  - `text-[#8888cc]` → `text-[var(--accent-purple)]`
  - `bg-[#1e2e1e]` → `bg-[var(--badge-green-bg)]`
  - `text-[#81c784]` → `text-[var(--accent-green-light)]`
  - `bg-[#2e2e1e]` → `bg-[var(--badge-yellow-bg)]`
  - `text-[#cccc66]` → `text-[var(--accent-yellow)]`

- [ ] **B2**: Add modal accessibility to the "new project" modal (lines 45-98):
  - Add `role="dialog"` and `aria-modal="true"` to the overlay div
  - Add `aria-labelledby="new-project-title"` to the overlay
  - Add `id="new-project-title"` to the `<h2>` heading
  - Add `aria-label="프로젝트 이름"` to the name input
  - Add `aria-label="프로젝트 설명"` to the description input
  - Add `onKeyDown` handler to close on Escape key press

- [ ] **B3**: Add modal accessibility to the "delete confirm" modal (lines 100-126):
  - Add `role="dialog"` and `aria-modal="true"` to the overlay div
  - Add `aria-labelledby="delete-project-title"` to the overlay
  - Add `id="delete-project-title"` to the `<h2>` heading
  - Add `onKeyDown` handler to close on Escape key press
  - Add `onClick` on backdrop to dismiss (currently missing — backdrop is not clickable on delete modal)

- [ ] **B4**: Make project cards keyboard-accessible (lines 138-170):
  - Add `role="article"` to each card div
  - Add `tabIndex={0}` to each card
  - Add `onKeyDown` handler: Enter/Space navigates to project
  - Add visible focus ring: `focus-visible:ring-2 focus-visible:ring-[var(--accent-green)] focus-visible:outline-none`
  - Change delete button `×` to include `aria-label="프로젝트 삭제"` and use a proper × character or SVG icon

- [ ] **B5**: Add error states:
  - Add `projects.isError` check after loading check — show error message with retry button calling `projects.refetch()`
  - Add `onError` callback to `createProject` mutation — show error text below the form inputs inside the modal
  - Add `onError` callback to `deleteProject` mutation — re-show the deleteConfirm modal with error text instead of immediately closing
  - Track `createProject.isError` / `createProject.error?.message` and display in modal
  - Track `deleteProject.isPending` state — disable delete button and show "삭제 중..." while pending

- [ ] **B6**: Add subtle transition animation to modals:
  - Wrap modal content in a div with Tailwind `animate-in` or use CSS `@keyframes fadeIn` + `@keyframes scaleIn`
  - Add the keyframes to `globals.css` if not using Tailwind animate plugin:
    ```css
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    ```
  - Apply `animate-[fadeIn_150ms_ease-out]` to backdrop
  - Apply `animate-[scaleIn_150ms_ease-out]` to modal content div

- [ ] **B7**: Reset form state when closing the new project modal:
  - In the close handler (both Escape and backdrop click), reset `newName` and `newDesc` to `""`
  - Also reset `createProject` error state if applicable (call `createProject.reset()`)

### Phase C: Improve projects/[id]/page.tsx

- [ ] **C1**: Replace ALL hardcoded hex colors with `var()` references:
  - `bg-[#0a0a0a]` → `bg-[var(--bg-deep)]`
  - `border-[#1a1a1a]` → `border-[var(--bg-secondary)]`
  - `text-[#555]` → `text-[var(--text-dim)]`
  - `text-[#333]` → `text-[var(--border-secondary)]`
  - `text-[#ffb74d]` → `text-[var(--accent-orange)]`
  - `bg-[#ffb74d]` → `bg-[var(--accent-orange)]`
  - `bg-[#1f1f1f]` → `bg-[var(--divider)]`
  - `hover:bg-[#4CAF50]` → `hover:bg-[var(--accent-green)]`
  - `to-[#0e0e0e]/70` → `to-[var(--bg-primary)]/70` (Note: check if Tailwind v4 supports opacity on var() — if not, use `to-[color-mix(in_srgb,var(--bg-primary)_70%,transparent)]` or keep as-is)

- [ ] **C2**: Extract message parsing logic (lines 30-87) to `web/src/lib/chat/parse-messages.ts`:
  - Create new file `web/src/lib/chat/parse-messages.ts`
  - Export function `parseInitialMessages(rawMessages: ChatMessage[]): UIMessage[]` containing the exact logic from lines 30-87
  - Define `ChatMessage` type matching the shape returned by `trpc.chat.listByProject`
  - In `[id]/page.tsx`, replace the `useMemo` body with: `const initialMessages = useMemo(() => parseInitialMessages(chatMessages.data ?? []), [chatMessages.data])`

- [ ] **C3**: Extract tool activity derivation (lines 94-132) to `web/src/lib/chat/tool-activity.ts`:
  - Create new file `web/src/lib/chat/tool-activity.ts`
  - Move the `ToolActivity` type definition there (currently exported from page.tsx)
  - Export function `deriveToolActivity(messages: UIMessage[]): ToolActivity` containing the exact logic
  - In `[id]/page.tsx`, replace with: `const toolActivity = useMemo(() => deriveToolActivity(chat.messages), [chat.messages])`
  - Update any imports of `ToolActivity` type (check `gallery-panel.tsx` and `chat-panel.tsx`)

- [ ] **C4**: Add error state handling:
  - After the loading check on line 172, add: `if (project.isError) return <ErrorState message="프로젝트를 불러올 수 없습니다" onRetry={() => project.refetch()} />`
  - Create a simple inline `ErrorState` component (or add to the same file) with: error message text, retry button, back-to-projects link
  - Handle `chatMessages.isError` similarly

- [ ] **C5**: Add keyboard accessibility to split pane divider:
  - Add `role="separator"`, `aria-orientation="vertical"`, `tabIndex={0}`, `aria-valuenow={splitPos}`, `aria-valuemin={25}`, `aria-valuemax={75}` to the divider div
  - Add `onKeyDown` handler: ArrowLeft decreases splitPos by 5 (min 25), ArrowRight increases by 5 (max 75)
  - Add `aria-label="패널 크기 조절"` to the divider
  - Add double-click handler to reset to default (40%)

- [ ] **C6**: Add touch event support to split pane for mobile:
  - In the `useEffect` on lines 138-147, add `touchmove` and `touchend` listeners alongside `mousemove` and `mouseup`
  - Add `onTouchStart` handler to divider alongside `onMouseDown`
  - In `touchmove` handler, use `e.touches[0].clientX` instead of `e.clientX`

- [ ] **C7**: Add basic mobile responsiveness:
  - On screens < 768px, stack panels vertically instead of side-by-side
  - Add state: `const [mobilePanel, setMobilePanel] = useState<'chat' | 'gallery'>('chat')`
  - Conditionally render either the split view (desktop) or a tab-switched single panel (mobile)
  - Add a simple tab bar for mobile with "대화" / "갤러리" toggle buttons
  - Use `useMediaQuery` or a simple `window.innerWidth` check with resize listener (or Tailwind `md:` breakpoints if achievable with CSS only)

### Phase D: Add Shared Animation Keyframes

- [ ] **D1**: Add animation keyframes to `globals.css`:
  ```css
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95) translateY(4px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  ```

## Parallelization Plan

### Batch 1 (parallel — foundation)
- [ ] **Coder A**: Tasks A1, D1 → files: `web/src/app/globals.css` ONLY
- [ ] **Coder B**: Tasks C2, C3 → files: `web/src/lib/chat/parse-messages.ts` (new), `web/src/lib/chat/tool-activity.ts` (new) ONLY

### Batch 2 (parallel — after Batch 1, depends on new CSS vars)
- [ ] **Coder C**: Tasks B1, B2, B3, B4, B5, B6, B7 → files: `web/src/app/projects/page.tsx` ONLY
- [ ] **Coder D**: Tasks C1, C4, C5, C6, C7 → files: `web/src/app/projects/[id]/page.tsx` ONLY

### Batch 3 (sequential — after Batch 2, if ToolActivity import changed)
- [ ] **Coder E**: Update `ToolActivity` imports in `web/src/components/gallery-panel.tsx` if C3 moved the type → files: `web/src/components/gallery-panel.tsx` ONLY

### Dependencies
- **Batch 1 before Batch 2**: CSS variables (A1) must exist before pages can reference them. Extracted utilities (C2, C3) must exist before [id]/page.tsx can import them.
- **Batch 2 tasks are independent**: `page.tsx` and `[id]/page.tsx` don't import from each other.
- **Batch 3 after C3**: Only needed if `ToolActivity` type was previously imported from `[id]/page.tsx` by other components.

### Risk Areas
- **Tailwind v4 + CSS var() in arbitrary values**: `bg-[var(--accent-green)]` should work in Tailwind v4, but opacity modifiers like `bg-[var(--accent-green)]/50` may not work. Coder should test this and fall back to `color-mix()` or hardcoded values if needed.
- **Gradient with var()**: `to-[#0e0e0e]/70` uses Tailwind opacity modifier on arbitrary color — may not work with `var()`. Keep hardcoded if it breaks.
- **ToolActivity re-export**: If `gallery-panel.tsx` or `chat-panel.tsx` imports `ToolActivity` from `[id]/page.tsx`, moving it to `tool-activity.ts` requires updating those imports. Coder must grep for `import.*ToolActivity` first.
- **Mobile responsiveness (C7)**: This is the highest-risk task since it changes layout structure. Should be carefully tested. If time-constrained, can be deferred.

## Done Criteria
- [ ] All hardcoded hex colors in both page files replaced with CSS variable references
- [ ] Both modals have proper `role="dialog"`, `aria-modal`, `aria-labelledby`, and Escape key support
- [ ] Project cards are keyboard navigable (Tab, Enter/Space)
- [ ] Error states displayed for failed queries and mutations
- [ ] Delete mutation shows loading state and handles errors gracefully
- [ ] Message parsing logic extracted to `web/src/lib/chat/parse-messages.ts`
- [ ] Tool activity logic extracted to `web/src/lib/chat/tool-activity.ts`
- [ ] Split pane has keyboard support (arrow keys) and double-click reset
- [ ] Modal open/close has subtle animation (fade + scale)
- [ ] New project modal resets form state on close
- [ ] App builds without errors (`npm run build` or `next build`)
- [ ] No visual regressions — dark theme looks identical to before
