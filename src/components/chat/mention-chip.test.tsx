import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MentionChip } from "./mention-chip"

const mention = {
  logoId: "logo-1",
  versionId: "version-1",
  orderIndex: 1,
  versionNumber: 2,
  imageUrl: "https://example.com/logo.png",
}

afterEach(() => {
  cleanup()
})

describe("MentionChip", () => {
  it("renders #N vM label", () => {
    render(<MentionChip data={mention} />)
    expect(screen.getByText("#2 v2")).toBeTruthy()
  })

  it("fires onRemove when × is clicked", () => {
    const onRemove = vi.fn()
    render(<MentionChip data={mention} onRemove={onRemove} />)

    fireEvent.click(screen.getByRole("button", { name: "멘션 제거" }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it("shows deleted state and blocks interaction when disabled", () => {
    const onRemove = vi.fn()
    render(<MentionChip data={mention} onRemove={onRemove} disabled />)

    expect(screen.getByText("삭제됨")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "멘션 제거" })).toBeNull()
    expect(onRemove).not.toHaveBeenCalled()
  })
})
