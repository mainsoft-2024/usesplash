"use client"

import { useChat as useAIChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export function useProjectChat(projectId: string, initialMessages?: UIMessage[]) {
  const [input, setInput] = useState("")
  const prevLengthRef = useRef(0)

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: "/api/chat",
      body: { projectId },
      fetch: async (url, init) => {
        const res = await fetch(url, init)
        if (res.status === 403) {
          const data = await res.json().catch(() => null)
          const err = new Error(data?.message ?? "일일 생성 한도를 초과했습니다.")
          ;(err as any).code = data?.error ?? "DAILY_LIMIT_REACHED"
          throw err
        }
        return res
      },
    }),
    [projectId]
  )

  const chat = useAIChat({
    id: projectId,
    transport,
    messages: initialMessages,
  })

  useEffect(() => {
    const nextLength = initialMessages?.length ?? 0
    const prevLength = prevLengthRef.current

    if (prevLength === 0 && nextLength > 0 && initialMessages) {
      chat.setMessages(initialMessages)
    }

    prevLengthRef.current = nextLength
  }, [initialMessages])

  const sendMessage = useCallback(
    (content: string, fileParts?: Array<{ type: "file"; mediaType: string; url: string }>) => {
      if (fileParts?.length) {
        chat.sendMessage({
          role: "user",
          parts: [{ type: "text" as const, text: content }, ...fileParts],
        })
      } else {
        chat.sendMessage({ text: content })
      }
    },
    [chat]
  )

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>, fileParts?: Array<{ type: "file"; mediaType: string; url: string }>) => {
      event.preventDefault()
      const content = input.trim()
      if (!content && !fileParts?.length) return
      if (fileParts?.length) {
        chat.sendMessage({
          role: "user",
          parts: [
            ...(content ? [{ type: "text" as const, text: content }] : []),
            ...fileParts,
          ],
        })
      } else {
        chat.sendMessage({ text: content })
      }
      setInput("")
    },
    [chat, input]
  )

  return {
    messages: chat.messages,
    input,
    setInput,
    handleSubmit,
    sendMessage,
    isLoading: chat.status === "submitted" || chat.status === "streaming",
    error: chat.error as (Error & { code?: string }) | undefined,
    reload: chat.regenerate,
    stop: chat.stop,
  }
}