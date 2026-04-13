"use client"

import { use, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { useProjectChat } from "@/lib/chat/hooks"
import { parseInitialMessages } from "@/lib/chat/parse-messages"
import { deriveToolActivity, type ToolActivity } from "@/lib/chat/tool-activity"
import { ChatPanel } from "@/components/chat-panel"
import { GalleryPanel } from "@/components/gallery-panel"
import { LoadingScreen } from "@/components/spinners"

export default function ProjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const [splitPos, setSplitPos] = useState(40)
  const dragging = useRef(false)
  const [mobilePanel, setMobilePanel] = useState<"chat" | "gallery">("chat")
  const [isMobile, setIsMobile] = useState(false)

  const project = trpc.project.get.useQuery({ id: projectId })
  const logos = trpc.logo.listByProject.useQuery({ projectId })
  const chatMessages = trpc.chat.listByProject.useQuery({ projectId })

  const initialMessages = useMemo(
    () => parseInitialMessages(chatMessages.data ?? []),
    [chatMessages.data],
  )

  const chat = useProjectChat(
    projectId,
    initialMessages,
  )

  const toolActivity = useMemo(
    () => deriveToolActivity(chat.messages),
    [chat.messages],
  )

  const prevActivityRef = useRef<string>("idle")

  const handleMouseDown = useCallback(() => { dragging.current = true }, [])
  const handleTouchStart = useCallback(() => { dragging.current = true }, [])
  const handleSeparatorKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      setSplitPos((prev) => Math.max(25, prev - 5))
    }
    if (e.key === "ArrowRight") {
      e.preventDefault()
      setSplitPos((prev) => Math.min(75, prev + 5))
    }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      setSplitPos(Math.max(25, Math.min(75, (e.clientX / window.innerWidth) * 100)))
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return
      const touch = e.touches[0]
      if (!touch) return
      setSplitPos(Math.max(25, Math.min(75, (touch.clientX / window.innerWidth) * 100)))
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    window.addEventListener("touchmove", onTouchMove)
    window.addEventListener("touchend", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onUp)
    }
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

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  if (project.isLoading || chatMessages.isLoading) return <LoadingScreen />

  if (project.isError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-deep)] p-4">
        <div className="w-full max-w-md rounded-xl border border-[var(--bg-secondary)] bg-[var(--bg-deep)] p-6">
          <h2 className="mb-2 text-lg font-semibold">프로젝트를 불러오지 못했습니다</h2>
          <p className="mb-4 text-sm text-[var(--text-dim)]">잠시 후 다시 시도해주세요.</p>
          <div className="flex gap-2">
            <button onClick={() => project.refetch()} className="rounded-md bg-[var(--accent-orange)] px-3 py-2 text-sm font-medium text-black">
              다시 시도
            </button>
            <button onClick={() => router.push("/projects")} className="rounded-md border border-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-dim)]">
              프로젝트 목록으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (chatMessages.isError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-deep)] p-4">
        <div className="w-full max-w-md rounded-xl border border-[var(--bg-secondary)] bg-[var(--bg-deep)] p-6">
          <h2 className="mb-2 text-lg font-semibold">대화 기록을 불러오지 못했습니다</h2>
          <p className="mb-4 text-sm text-[var(--text-dim)]">채팅 기록 없이 계속할 수도 있습니다.</p>
          <div className="flex gap-2">
            <button onClick={() => chatMessages.refetch()} className="rounded-md bg-[var(--accent-orange)] px-3 py-2 text-sm font-medium text-black">
              다시 시도
            </button>
            <button onClick={() => router.push("/projects")} className="rounded-md border border-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-dim)]">
              프로젝트 목록으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-deep)]">
      <div className="h-12 flex-shrink-0 border-b border-[var(--bg-secondary)] bg-[var(--bg-deep)] px-4">
        <div className="flex h-full items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => router.push("/projects")} className="text-sm text-[var(--text-dim)] transition-colors hover:text-white">
              ← 프로젝트목록
            </button>
            <span className="text-[var(--border-secondary)]">|</span>
            <span className="max-w-[260px] truncate text-sm font-medium">{project.data?.name}</span>
          </div>
          <div className="flex items-center gap-3">
            {chat.isLoading && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--accent-orange)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-orange)]" />
                AI 응답 중
              </span>
            )}
            <span className="text-xs text-[var(--text-dim)]">{logos.data?.length ?? 0} logos</span>
          </div>
        </div>
      </div>

      {isMobile && (
        <div className="flex h-11 flex-shrink-0 border-b border-[var(--bg-secondary)] bg-[var(--bg-deep)] px-2">
          <button
            onClick={() => setMobilePanel("chat")}
            className={`flex-1 rounded-md px-3 text-sm ${mobilePanel === "chat" ? "bg-[var(--bg-secondary)] text-white" : "text-[var(--text-dim)]"}`}
          >
            대화
          </button>
          <button
            onClick={() => setMobilePanel("gallery")}
            className={`flex-1 rounded-md px-3 text-sm ${mobilePanel === "gallery" ? "bg-[var(--bg-secondary)] text-white" : "text-[var(--text-dim)]"}`}
          >
            갤러리
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {isMobile ? (
          mobilePanel === "chat" ? (
            <div className="h-full w-full">
              <ChatPanel chat={chat} />
            </div>
          ) : (
            <div className="h-full w-full overflow-hidden">
              <GalleryPanel
                logos={logos.data ?? []}
                isLoading={logos.isLoading}
                projectId={projectId}
                onRefresh={() => logos.refetch()}
                toolActivity={toolActivity}
              />
            </div>
          )
        ) : (
          <>
            <div style={{ width: `${splitPos}%` }} className="h-full flex-shrink-0">
              <ChatPanel chat={chat} />
            </div>
            <div className="relative w-1 flex-shrink-0">
              <div
                role="separator"
                aria-orientation="vertical"
                tabIndex={0}
                aria-valuenow={splitPos}
                aria-valuemin={25}
                aria-valuemax={75}
                aria-label="패널 크기 조절"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onKeyDown={handleSeparatorKeyDown}
                onDoubleClick={() => setSplitPos(40)}
                className="absolute inset-0 cursor-col-resize bg-[var(--divider)] transition-colors hover:bg-[var(--accent-green)]"
              />
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
          </>
        )}
      </div>
    </div>
  )
}