"use client"

import { useChat as useAIChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useCallback, useState } from "react"

export function useProjectChat(projectId: string, initialMessages?: UIMessage[]) {
  const [input, setInput] = useState("")

  const chat = useAIChat({
    id: projectId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { projectId },
    }),
  })

  const sendMessage = useCallback(
    (content: string) => {
      chat.sendMessage({ text: content })
    },
    [chat]
  )

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const content = input.trim()
      if (!content) return
      chat.sendMessage({ text: content })
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
    error: chat.error,
    reload: chat.regenerate,
    stop: chat.stop,
  }
}