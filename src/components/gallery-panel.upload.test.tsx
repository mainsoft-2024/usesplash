import { render, screen, fireEvent, cleanup, act } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { GalleryPanel } from "./gallery-panel"
import { MAX_FILE_SIZE, MAX_FILES_PER_BATCH } from "@/lib/attachment-constants"

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

const mutateAsyncMock = vi.fn()
const invalidateListMock = vi.fn()
const invalidateProjectMock = vi.fn()

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    export: {
      crop: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false, data: null }),
      },
      vectorize: {
        useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
      },
    },
    logo: {
      uploadBaseImage: {
        useMutation: () => ({ mutateAsync: mutateAsyncMock }),
      },
    },
    useUtils: () => ({
      logo: {
        listByProject: { invalidate: invalidateListMock },
        invalidate: vi.fn(),
      },
      project: { invalidate: invalidateProjectMock },
    }),
  },
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  }),
}))

vi.mock("@/lib/chat/composer-store", () => ({
  useComposerStore: Object.assign(
    (selector: (state: { activeProjectId: string | null; addMention: () => boolean }) => unknown) =>
      selector({ activeProjectId: null, addMention: () => true }),
    {
      getState: () => ({ activeProjectId: null, addMention: () => true }),
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

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function makePng(name = "test.png", size = 100): File {
  return new File([new Uint8Array(size)], name, { type: "image/png" })
}

const defaultProps = {
  logos: [],
  isLoading: false,
  projectId: "proj-1",
  onRefresh: vi.fn(),
}

type MockFileReader = {
  result: string
  onload: ((e: unknown) => void) | null
  onerror: null
  readAsDataURL: () => void
}

function makeMockFileReader(): MockFileReader {
  const reader: MockFileReader = {
    result: "data:image/png;base64,abc",
    onload: null,
    onerror: null,
    readAsDataURL() { setTimeout(() => reader.onload?.({}), 0) },
  }
  return reader
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("GalleryPanel upload", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset()
    invalidateListMock.mockReset()
    invalidateProjectMock.mockReset()
    mutateAsyncMock.mockResolvedValue({})
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // T18 – boilerplate / smoke
  it("T18: renders without crashing", () => {
    render(<GalleryPanel {...defaultProps} />)
    expect(screen.getByTestId("gallery-upload-button")).toBeTruthy()
  })

  // T19 – clicking upload button triggers hidden input click
  it("T19: clicking upload button triggers file input click", () => {
    render(<GalleryPanel {...defaultProps} />)
    const input = screen.getByTestId("gallery-upload-input") as HTMLInputElement
    const clickSpy = vi.spyOn(input, "click")
    fireEvent.click(screen.getByTestId("gallery-upload-button"))
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  // T20 – selecting a valid PNG shows optimistic skeleton immediately
  it("T20: selecting valid PNG shows uploading skeleton", async () => {
    // Mock FileReader to resolve immediately
    const originalFileReader = global.FileReader
    const mockFileReader = makeMockFileReader()
    global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader

    // Make mutateAsync hang so skeleton stays visible
    mutateAsyncMock.mockReturnValue(new Promise(() => {}))

    render(<GalleryPanel {...defaultProps} />)
    const input = screen.getByTestId("gallery-upload-input") as HTMLInputElement
    const file = makePng()
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(screen.getByTestId("pending-upload-uploading")).toBeTruthy()

    global.FileReader = originalFileReader
  })

  // T21 – on success skeleton disappears and invalidate called
  it("T21: on mutation success skeleton removed and invalidate called", async () => {
    const originalFileReader = global.FileReader
    const mockFileReader = makeMockFileReader()
    global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader
    mutateAsyncMock.mockResolvedValue({})

    render(<GalleryPanel {...defaultProps} />)
    const input = screen.getByTestId("gallery-upload-input") as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { files: [makePng()] } })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.queryByTestId("pending-upload-uploading")).toBeNull()
    expect(invalidateListMock).toHaveBeenCalledWith({ projectId: "proj-1" })

    global.FileReader = originalFileReader
  })

  // T22 – on mutation error skeleton flips to error + toast.error called
  it("T22: on mutation error skeleton shows error state and toast fires", async () => {
    const { toast } = await import("sonner")
    const originalFileReader = global.FileReader
    const mockFileReader = makeMockFileReader()
    global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader
    mutateAsyncMock.mockRejectedValue(new Error("업로드 실패"))

    render(<GalleryPanel {...defaultProps} />)
    const input = screen.getByTestId("gallery-upload-input") as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { files: [makePng()] } })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByTestId("pending-upload-error")).toBeTruthy()
    expect(toast.error).toHaveBeenCalled()

    global.FileReader = originalFileReader
  })

  // T23 – 15 files → warning toast, mutateAsync called at most 10 times
  it("T23: providing 15 files shows batch-cap warning and caps at 10", async () => {
    const { toast } = await import("sonner")
    const originalFileReader = global.FileReader
    const mockFileReader = makeMockFileReader()
    global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader
    mutateAsyncMock.mockResolvedValue({})

    render(<GalleryPanel {...defaultProps} />)
    const input = screen.getByTestId("gallery-upload-input") as HTMLInputElement
    const files = Array.from({ length: 15 }, (_, i) => makePng(`file${i}.png`))
    await act(async () => {
      fireEvent.change(input, { target: { files } })
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("최대 10개")
    )
    expect(mutateAsyncMock.mock.calls.length).toBeLessThanOrEqual(MAX_FILES_PER_BATCH)

    global.FileReader = originalFileReader
  })

  // T24 – oversize file rejected client-side
  it("T24: oversize file is rejected with toast, mutateAsync not called", async () => {
    const { toast } = await import("sonner")
    render(<GalleryPanel {...defaultProps} />)
    const input = screen.getByTestId("gallery-upload-input") as HTMLInputElement
    const bigFile = new File([new Uint8Array(MAX_FILE_SIZE + 1)], "big.png", { type: "image/png" })
    await act(async () => {
      fireEvent.change(input, { target: { files: [bigFile] } })
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("최대 4MB"))
    expect(mutateAsyncMock).not.toHaveBeenCalled()
  })

  // T25 – HEIC file rejected client-side
  it("T25: HEIC file rejected with mime-type toast", async () => {
    const { toast } = await import("sonner")
    render(<GalleryPanel {...defaultProps} />)
    const input = screen.getByTestId("gallery-upload-input") as HTMLInputElement
    const heicFile = new File([new Uint8Array(100)], "photo.heic", { type: "image/heic" })
    await act(async () => {
      fireEvent.change(input, { target: { files: [heicFile] } })
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("PNG, JPEG, WebP"))
    expect(mutateAsyncMock).not.toHaveBeenCalled()
  })

  // T26 – dragenter shows overlay
  it("T26: dragenter on container shows drop overlay", () => {
    const { container } = render(<GalleryPanel {...defaultProps} />)
    const gallery = container.firstChild as HTMLElement
    fireEvent.dragEnter(gallery, { dataTransfer: {} })
    expect(screen.getByTestId("gallery-drop-overlay")).toBeTruthy()
  })

  // T27 – dragleave hides overlay when counter reaches 0
  it("T27: dragleave removes drop overlay when counter is zero", () => {
    const { container } = render(<GalleryPanel {...defaultProps} />)
    const gallery = container.firstChild as HTMLElement
    fireEvent.dragEnter(gallery, { dataTransfer: {} })
    fireEvent.dragLeave(gallery, { dataTransfer: {} })
    expect(screen.queryByTestId("gallery-drop-overlay")).toBeNull()
  })

  // T28 – drop with image triggers handleFiles
  it("T28: drop with image file triggers mutateAsync", async () => {
    const originalFileReader = global.FileReader
    const mockFileReader = makeMockFileReader()
    global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader
    mutateAsyncMock.mockResolvedValue({})

    const { container } = render(<GalleryPanel {...defaultProps} />)
    const gallery = container.firstChild as HTMLElement
    const file = makePng()
    await act(async () => {
      fireEvent.drop(gallery, {
        dataTransfer: { files: [file] },
      })
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "proj-1", mimeType: "image/png" })
    )

    global.FileReader = originalFileReader
  })

  // T29 – drop with text/plain file is filtered out
  it("T29: drop with text/plain file does not call mutateAsync", async () => {
    const { container } = render(<GalleryPanel {...defaultProps} />)
    const gallery = container.firstChild as HTMLElement
    const textFile = new File(["hello"], "note.txt", { type: "text/plain" })
    await act(async () => {
      fireEvent.drop(gallery, { dataTransfer: { files: [textFile] } })
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(mutateAsyncMock).not.toHaveBeenCalled()
  })
})