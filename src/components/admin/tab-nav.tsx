"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

export type InsightsTabSlug = "overview" | "cost" | "revenue" | "users" | "assets"

const TAB_ITEMS: Array<{ slug: InsightsTabSlug; label: string }> = [
  { slug: "overview", label: "개요" },
  { slug: "cost", label: "비용" },
  { slug: "revenue", label: "수익" },
  { slug: "users", label: "사용자" },
  { slug: "assets", label: "자료" },
]

function parseTab(value: string | null): InsightsTabSlug {
  if (value === "overview" || value === "cost" || value === "revenue" || value === "users" || value === "assets") {
    return value
  }

  return "overview"
}

export function TabNav() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = parseTab(searchParams.get("tab"))

  const setTab = (tab: InsightsTabSlug) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tab)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <nav className="mb-6 flex items-center gap-6 border-b border-[#2a2a2a]">
      {TAB_ITEMS.map((tab) => {
        const isActive = tab.slug === activeTab

        return (
          <button
            key={tab.slug}
            type="button"
            onClick={() => setTab(tab.slug)}
            className={[
              "pb-3 text-sm transition-colors",
              isActive
                ? "border-b-2 border-[var(--accent-green)] font-medium text-white"
                : "border-b-2 border-transparent text-[#a1a1a1] hover:text-white",
            ].join(" ")}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
