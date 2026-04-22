import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ChatPanel } from "@/components/chat-panel"
import { useGallerySpotlightStore } from "@/lib/chat/gallery-spotlight-store"

function createChat(parts: Array<Record<string, unknown>>) {
  return {
    messages: [
      {
        id: "m1",
        role: "user",
        parts,
      },
    ],
    input: "",
    isLoading: false,
    error: null,
    stop: vi.fn(),
    sendMessage: vi.fn(),
    setInput: vi.fn(),
  } as any
}

describe("ChatPanel history mentions", () => {
  beforeEach(() => {
    useGallerySpotlightStore.getState().clear()
    ;(HTMLElement.prototype as any).scrollIntoView = vi.fn()
  })

  it("renders two mention chips above text and click spotlights gallery version", () => {
    const spotlightSpy = vi.spyOn(useGallerySpotlightStore.getState(), "spotlight")
    const chat = createChat([
      {
        type: "data-mention",
        data: {
          logoId: "l1",
          versionId: "v1",
          orderIndex: 0,
          versionNumber: 1,
          imageUrl: "https://example.com/v1.png",
        },
      },
      {
        type: "data-mention",
        data: {
          logoId: "l2",
          versionId: "v2",
          orderIndex: 1,
          versionNumber: 1,
          imageUrl: "https://example.com/v2.png",
        },
      },
      { type: "text", text: "두 로고 합쳐줘" },
    ])

    render(
      <ChatPanel
        chat={chat}
        projectId="p1"
        logos={[
          { id: "l1", orderIndex: 0, versions: [{ id: "v1", versionNumber: 1, imageUrl: "https://example.com/v1.png" }] },
          { id: "l2", orderIndex: 1, versions: [{ id: "v2", versionNumber: 1, imageUrl: "https://example.com/v2.png" }] },
        ]}
      />
    )

    const chip1 = screen.getByText(/#1\s*v1/)
    const chip2 = screen.getByText(/#2\s*v1/)
    const text = screen.getByText("두 로고 합쳐줘")

    expect(chip1.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(chip2.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(chip1)
    expect(spotlightSpy).toHaveBeenCalledWith("v1")
  })

  it('renders unknown version mention as disabled with "삭제됨"', () => {
    const chat = createChat([
      {
        type: "data-mention",
        data: {
          logoId: "l3",
          versionId: "missing-version",
          orderIndex: 2,
          versionNumber: 7,
          imageUrl: "https://example.com/missing.png",
        },
      },
      { type: "text", text: "이 버전으로 해줘" },
    ])

    render(<ChatPanel chat={chat} projectId="p1" logos={[]} />)

    expect(screen.getByText("삭제됨")).toBeTruthy()
    expect(screen.getByText(/#3\s*v7/)).toBeTruthy()
  })
})
