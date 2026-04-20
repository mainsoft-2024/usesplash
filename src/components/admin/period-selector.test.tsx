import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PeriodSelector } from "./period-selector"

const push = vi.fn()
const useSearchParams = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin",
  useSearchParams: () => useSearchParams(),
}))

describe("PeriodSelector", () => {
  beforeEach(() => {
    cleanup()
    push.mockReset()
  })

  it("uses default period 30 when query is invalid", () => {
    useSearchParams.mockReturnValue(new URLSearchParams("period=invalid"))
    render(<PeriodSelector />)

    const active = screen.getByRole("button", { name: "30일" })
    expect(active.className).toContain("text-white")
  })

  it("updates URL period query on click", () => {
    useSearchParams.mockReturnValue(new URLSearchParams("tab=overview&period=30"))
    render(<PeriodSelector />)

    fireEvent.click(screen.getByRole("button", { name: "90일" }))
    expect(push).toHaveBeenCalledWith("/admin?tab=overview&period=90")
  })
})
