import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ChatPanel } from "./chat-panel"

vi.mock("@/lib/chat/composer-store", () => {
  const composerState = {
    mentionsByProject: {} as Record<string, unknown[]>,
    addMention: vi.fn(() => true),
    removeMention: vi.fn(),
    setActiveProject: vi.fn(),
    clear: vi.fn(),
  }
  const useComposerStore = Object.assign(
    (selector: (state: typeof composerState) => unknown) => selector(composerState),
    { getState: () => composerState }
  )
  return { useComposerStore }
})

vi.mock("@/lib/chat/gallery-spotlight-store", () => {
  const gallerySpotlightState = { spotlight: vi.fn() }
  const useGallerySpotlightStore = Object.assign(
    (selector: (state: typeof gallerySpotlightState) => unknown) => selector(gallerySpotlightState),
    { getState: () => gallerySpotlightState }
  )
  return { useGallerySpotlightStore }
})

vi.mock("@/components/spinners", () => ({
  PulseSpinner: () => <div data-testid="pulse-spinner" />,
  WaveSpinner: () => <div data-testid="wave-spinner" />,
}))

vi.mock("@/components/chat-markdown", () => ({
  ChatMarkdown: ({ content }: { content: string }) => <p>{content}</p>,
}))

vi.mock("@/components/chat/mention-chip", () => ({
  MentionChip: () => <div data-testid="mention-chip" />,
}))

vi.mock("@/components/chat/logo-mention-picker", () => ({
  LogoMentionPicker: () => null,
}))

function createChatWithEditLogoOutput(output: Record<string, unknown>) {
  return {
    messages: [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-edit_logo",
            state: "output-available",
            output,
          },
        ],
      },
    ],
    input: "",
    setInput: vi.fn(),
    sendMessage: vi.fn(),
    isLoading: false,
    stop: vi.fn(),
    error: null,
  }
}

describe("ChatPanel edit_logo output-available error handling", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it("renders failure box when output contains error string", () => {
    const chat = createChatWithEditLogoOutput({
      error: "Referenced versions not found: cmo...",
    })

    render(<ChatPanel chat={chat as any} logos={[]} />)

    expect(screen.getByText("편집 실패")).toBeTruthy()
    expect(screen.queryByText(/편집 완료/)).toBeNull()
    expect(screen.getByText("Referenced versions not found: cmo...")).toBeTruthy()
  })

  it("renders success box when output has logoIndex/versionNumber", () => {
    const chat = createChatWithEditLogoOutput({
      logoIndex: 3,
      versionNumber: 2,
    })

    render(<ChatPanel chat={chat as any} logos={[]} />)

    expect(screen.getByText("로고 #3 v2 편집 완료")).toBeTruthy()
  })
})
