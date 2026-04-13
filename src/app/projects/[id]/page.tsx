"use client"

import { use, useCallback, useEffect, useRef, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { useProjectChat } from "@/lib/chat/hooks"
import { ChatPanel } from "@/components/chat-panel"
import { GalleryPanel } from "@/components/gallery-panel"

export default function ProjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const [splitPos, setSplitPos] = useState(40)
  const dragging = useRef(false)

  const project = trpc.project.get.useQuery({ id: projectId })
  const logos = trpc.logo.listByProject.useQuery({ projectId })
  const chat = useProjectChat(projectId)

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

  if (project.isLoading) return <div className="flex items-center justify-center h-screen text-[#666]">로딩 중...</div>

  return (
    <div className="h-screen flex overflow-hidden">
      <div style={{ width: `${splitPos}%` }} className="h-full flex-shrink-0">
        <ChatPanel projectName={project.data?.name ?? ""} chat={chat} projectId={projectId} />
      </div>
      <div className="w-1 bg-[#2a2a2a] hover:bg-[#4CAF50] cursor-col-resize transition-colors flex-shrink-0" onMouseDown={handleMouseDown} />
      <div style={{ width: `${100 - splitPos}%` }} className="h-full flex-shrink-0 overflow-hidden">
        <GalleryPanel logos={logos.data ?? []} isLoading={logos.isLoading} projectId={projectId} onRefresh={() => logos.refetch()} />
      </div>
    </div>
  )
}