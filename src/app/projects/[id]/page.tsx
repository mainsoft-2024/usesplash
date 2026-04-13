"use client"

import { use, useCallback, useEffect, useRef, useState } from "react"
import type { UIMessage } from "ai"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { useProjectChat } from "@/lib/chat/hooks"
import { ChatPanel } from "@/components/chat-panel"
import { GalleryPanel } from "@/components/gallery-panel"

export default function ProjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const [splitPos, setSplitPos] = useState(40)
  const dragging = useRef(false)

  const project = trpc.project.get.useQuery({ id: projectId })
  const logos = trpc.logo.listByProject.useQuery({ projectId })
  const chatMessages = trpc.chat.listByProject.useQuery({ projectId })

  const initialMessages: UIMessage[] = (chatMessages.data ?? []).map((msg) => ({
    id: msg.id,
    role: msg.role === "assistant" ? "assistant" : "user",
    content: msg.content,
    parts: [{ type: "text", text: msg.content }],
    createdAt: new Date(msg.createdAt),
  }))

  const chat = useProjectChat(
    projectId,
    chatMessages.isSuccess ? initialMessages : undefined,
  )

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

  if (project.isLoading || chatMessages.isLoading) return <div className="flex items-center justify-center h-screen text-[#666]">로딩 중...</div>

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
          <GalleryPanel logos={logos.data ?? []} isLoading={logos.isLoading} projectId={projectId} onRefresh={() => logos.refetch()} />
        </div>
      </div>
    </div>
  )
}