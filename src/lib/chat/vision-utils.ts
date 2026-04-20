import type { UIMessage } from "ai"

type UIMessagePart = UIMessage["parts"][number]
type FilePart = Extract<UIMessagePart, { type: "file" }>

function isFilePart(part: UIMessagePart): part is FilePart {
  return part.type === "file"
}

export function reorderPartsTextFirst(parts: UIMessagePart[]): UIMessagePart[] {
  const nonFileParts: UIMessagePart[] = []
  const fileParts: UIMessagePart[] = []

  for (const part of parts) {
    if (isFilePart(part)) {
      fileParts.push(part)
    } else {
      nonFileParts.push(part)
    }
  }

  return [...nonFileParts, ...fileParts]
}

export function limitImagesPerTurn(messages: UIMessage[], maxImages = 5): UIMessage[] {
  if (maxImages < 0) return messages

  const fileRefs: Array<{ messageIndex: number; partIndex: number }> = []

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
    const message = messages[messageIndex]
    for (let partIndex = 0; partIndex < message.parts.length; partIndex++) {
      if (isFilePart(message.parts[partIndex])) {
        fileRefs.push({ messageIndex, partIndex })
      }
    }
  }

  if (fileRefs.length <= maxImages) return messages

  const keepSet = new Set(
    fileRefs.slice(fileRefs.length - maxImages).map((ref) => `${ref.messageIndex}:${ref.partIndex}`),
  )

  return messages.map((message, messageIndex) => {
    const nextParts = message.parts.filter((part, partIndex) => {
      if (!isFilePart(part)) return true
      return keepSet.has(`${messageIndex}:${partIndex}`)
    })

    if (nextParts.length === message.parts.length) {
      return message
    }

    return {
      ...message,
      parts: nextParts,
    }
  })
}

export function extractFilePartsFromLastUserMessage(
  messages: UIMessage[],
): { message: UIMessage; fileParts: Array<{ index: number; url: string; mediaType: string }> } | null {
  const message = [...messages].reverse().find((item) => item.role === "user")
  if (!message) return null

  const fileParts = message.parts.flatMap((part, index) => {
    if (!isFilePart(part)) return []
    if (typeof part.url !== "string") return []
    if (typeof part.mediaType !== "string") return []

    return [{ index, url: part.url, mediaType: part.mediaType }]
  })

  if (fileParts.length === 0) return null

  return { message, fileParts }
}
