import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TabNav } from "./tab-nav"

const push = vi.fn()
const useSearchParams = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin",
  useSearchParams: () => useSearchParams(),
}))

describe("TabNav", () => {
  beforeEach(() => {
    cleanup()
    push.mockReset()
  })

  it("falls back to overview when tab is invalid", () => {
    useSearchParams.mockReturnValue(new URLSearchParams("tab=oops"))
    render(<TabNav />)

    const active = screen.getByRole("button", { name: "개요" })
    expect(active.className).toContain("text-white")
  })

  it("updates tab query while preserving period", () => {
    useSearchParams.mockReturnValue(new URLSearchParams("tab=overview&period=30"))
    render(<TabNav />)

    fireEvent.click(screen.getByRole("button", { name: "비용" }))
    expect(push).toHaveBeenCalledWith("/admin?tab=cost&period=30")
  })
})
