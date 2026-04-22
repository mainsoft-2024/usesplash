import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ChatPanel } from "./chat-panel"
import { useComposerStore } from "@/lib/chat/composer-store"
import { toast } from "sonner"

vi.mock("sonner", () => ({ toast: vi.fn() }))

function ChatHarness({ projectId = "p1", logos }: { projectId?: string; logos: any[] }) {
  const [input, setInput] = useState("")
  const sendMessage = vi.fn()

  return (
    <ChatPanel
      projectId={projectId}
      logos={logos}
      chat={{
        messages: [],
        input,
        setInput,
        handleSubmit: vi.fn(),
        sendMessage,
        isLoading: false,
        error: undefined,
        reload: vi.fn(),
        stop: vi.fn(),
      } as any}
    />
  )
}

const logos = [
  {
    id: "logo-1",
    orderIndex: 0,
    versions: [
      { id: "v1", versionNumber: 1, imageUrl: "https://example.com/1-1.png" },
      { id: "v2", versionNumber: 2, imageUrl: "https://example.com/1-2.png" },
    ],
  },
  {
    id: "logo-2",
    orderIndex: 1,
    versions: [
      { id: "v3", versionNumber: 1, imageUrl: "https://example.com/2-1.png" },
      { id: "v4", versionNumber: 2, imageUrl: "https://example.com/2-2.png" },
    ],
  },
]

beforeEach(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(globalThis as any).ResizeObserver = ResizeObserverMock
  ;(HTMLElement.prototype as any).scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
})

describe("ChatPanel mentions", () => {
  beforeEach(() => {
    useComposerStore.setState({ mentionsByProject: {}, activeProjectId: null })
    vi.clearAllMocks()
  })

  it("opens picker on @, but not while composing", async () => {
    render(<ChatHarness logos={logos} />)

    const textarea = screen.getAllByPlaceholderText("메시지를 입력하세요…").at(-1) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "@", selectionStart: 1 } })
    expect(await screen.findByLabelText("로고 멘션 선택")).toBeTruthy()

    fireEvent.change(textarea, { target: { value: "", selectionStart: 0 } })
    await waitFor(() => expect(screen.queryByLabelText("로고 멘션 선택")).toBeNull())

    fireEvent.compositionStart(textarea)
    fireEvent.change(textarea, { target: { value: "@", selectionStart: 1 }, nativeEvent: { isComposing: true } })
    await waitFor(() => expect(screen.queryByLabelText("로고 멘션 선택")).toBeNull())
  })

  it("selecting mention removes @token and adds mention", async () => {
    render(<ChatHarness logos={logos} />)

    const textarea = screen.getAllByPlaceholderText("메시지를 입력하세요…").at(-1) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "@2v1", selectionStart: 4 } })

    fireEvent.click(await screen.findByText("#2 v1"))

    await waitFor(() => {
      expect((screen.getByPlaceholderText("메시지를 입력하세요…") as HTMLTextAreaElement).value).toBe("")
      expect(useComposerStore.getState().mentionsByProject.p1).toHaveLength(1)
    })
  })

  it("backspace at caret 0 removes last chip", async () => {
    useComposerStore.setState({
      mentionsByProject: {
        p1: [
          { logoId: "logo-1", versionId: "v1", orderIndex: 0, versionNumber: 1, imageUrl: "https://example.com/1-1.png" },
          { logoId: "logo-2", versionId: "v3", orderIndex: 1, versionNumber: 1, imageUrl: "https://example.com/2-1.png" },
        ],
      },
      activeProjectId: "p1",
    })

    render(<ChatHarness logos={logos} />)
    const textarea = screen.getAllByPlaceholderText("메시지를 입력하세요…").at(-1) as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange(0, 0)

    fireEvent.keyDown(textarea, { key: "Backspace" })

    await waitFor(() => {
      const next = useComposerStore.getState().mentionsByProject.p1
      expect(next).toHaveLength(1)
      expect(next[0]?.versionId).toBe("v1")
    })
  })

  it("shows cap toast when adding 4th mention", async () => {
    useComposerStore.setState({
      mentionsByProject: {
        p1: [
          { logoId: "logo-1", versionId: "v1", orderIndex: 0, versionNumber: 1, imageUrl: "https://example.com/1-1.png" },
          { logoId: "logo-1", versionId: "v2", orderIndex: 0, versionNumber: 2, imageUrl: "https://example.com/1-2.png" },
          { logoId: "logo-2", versionId: "v3", orderIndex: 1, versionNumber: 1, imageUrl: "https://example.com/2-1.png" },
        ],
      },
      activeProjectId: "p1",
    })

    render(<ChatHarness logos={logos} />)
    const textarea = screen.getAllByPlaceholderText("메시지를 입력하세요…").at(-1) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "@2v2", selectionStart: 4 } })
    fireEvent.click(await screen.findByText("#2 v2"))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith("최대 3개까지 멘션할 수 있어요")
      expect(useComposerStore.getState().mentionsByProject.p1).toHaveLength(3)
    })
  })
})
