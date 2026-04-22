import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { GalleryPanel } from "./gallery-panel"

const addMentionMock = vi.fn()
let activeProjectId: string | null = null

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    export: {
      crop: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
          data: null,
        }),
      },
    },
  },
}))

vi.mock("@/lib/chat/composer-store", () => ({
  useComposerStore: Object.assign(
    (selector: (state: { activeProjectId: string | null; addMention: typeof addMentionMock }) => unknown) =>
      selector({ activeProjectId, addMention: addMentionMock }),
    {
      getState: () => ({
        activeProjectId,
        addMention: addMentionMock,
      }),
      subscribe: () => () => undefined,
    }
  ),
}))

vi.mock("@/lib/chat/gallery-spotlight-store", () => ({
  useGallerySpotlightStore: Object.assign(
    () => null,
    {
      subscribe: () => () => undefined,
      getState: () => ({ clear: vi.fn() }),
    }
  ),
}))

describe("GalleryPanel mention button", () => {
  beforeEach(() => {
    addMentionMock.mockReset()
    addMentionMock.mockReturnValue(true)
    activeProjectId = null
  })

  afterEach(() => {
    cleanup()
  })

  const logos = [
    {
      id: "logo-1",
      orderIndex: 0,
      prompt: "test",
      aspectRatio: "1:1",
      versions: [
        {
          id: "ver-1",
          versionNumber: 1,
          parentVersionId: null,
          imageUrl: "https://example.com/logo.png",
          editPrompt: null,
          s3Key: "s3-key",
          createdAt: new Date().toISOString(),
        },
      ],
    },
  ]

  it("calls composerStore.addMention when @ button is clicked", () => {
    render(<GalleryPanel logos={logos} isLoading={false} projectId="project-1" onRefresh={vi.fn()} />)

    fireEvent.click(screen.getByTestId("mention-button-ver-1"))

    expect(addMentionMock).toHaveBeenCalledWith("project-1", {
      logoId: "logo-1",
      versionId: "ver-1",
      orderIndex: 0,
      versionNumber: 1,
      imageUrl: "https://example.com/logo.png",
    })
  })

  it("renders disabled mention button with tooltip when project mismatches", () => {
    activeProjectId = "another-project"

    render(<GalleryPanel logos={logos} isLoading={false} projectId="project-1" onRefresh={vi.fn()} />)

    const button = screen.getByTestId("mention-button-ver-1")
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute("title")).toBe("현재 열린 채팅 프로젝트와 달라 인용할 수 없어요")
  })
})
