import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { LogoMentionPicker } from "./logo-mention-picker"

const versions = [
  { logoId: "l1", versionId: "v1", orderIndex: 0, versionNumber: 1, imageUrl: "https://example.com/1-1.png" },
  { logoId: "l2", versionId: "v2", orderIndex: 1, versionNumber: 1, imageUrl: "https://example.com/2-1.png" },
  { logoId: "l2", versionId: "v3", orderIndex: 1, versionNumber: 2, imageUrl: "https://example.com/2-2.png" },
]

beforeAll(() => {
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

describe("LogoMentionPicker", () => {
  it("filters by logo number with query=2", () => {
    render(
      <LogoMentionPicker
        versions={versions}
        open
        query="2"
        onQueryChange={() => {}}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )

    expect(screen.getByText("#2 v1")).toBeTruthy()
    expect(screen.getByText("#2 v2")).toBeTruthy()
    expect(screen.queryByText("#1 v1")).toBeNull()
  })

  it("filters by logo/version with query=2v1", () => {
    render(
      <LogoMentionPicker
        versions={versions}
        open
        query="2v1"
        onQueryChange={() => {}}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )

    expect(screen.getByText("#2 v1")).toBeTruthy()
    expect(screen.queryByText("#2 v2")).toBeNull()
  })

  it("shows empty-gallery copy", () => {
    render(
      <LogoMentionPicker
        versions={[]}
        open
        query=""
        onQueryChange={() => {}}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )

    expect(screen.getByText("아직 로고가 없습니다 — 먼저 로고를 생성해주세요.")).toBeTruthy()
  })

  it("calls onSelect for picked mention", () => {
    const onSelect = vi.fn()
    render(
      <LogoMentionPicker
        versions={versions}
        open
        query="2v1"
        onQueryChange={() => {}}
        onSelect={onSelect}
        onClose={() => {}}
      />
    )

    fireEvent.click(screen.getByText("#2 v1"))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ versionId: "v2" }))
  })
})
