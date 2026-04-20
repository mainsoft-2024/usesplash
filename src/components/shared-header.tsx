"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { HeaderLogo } from "./header-logo"

interface HeaderSession {
  user: {
    id: string
    email?: string | null
    name?: string | null
    image?: string | null
  }
}

const navLinks = [
  { label: "작동 방식", href: "/#how" },
  { label: "기능", href: "/#features" },
  { label: "요금제", href: "/pricing" },
]

export function SharedHeader({ session }: { session: HeaderSession | null }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [dropdownOpen])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDropdownOpen(false)
        setMobileOpen(false)
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [])

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  const user = session?.user
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? user?.email?.charAt(0)?.toUpperCase() ?? "?"

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/80 backdrop-blur-lg">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-xl font-bold" onClick={() => setMobileOpen(false)}>
          <HeaderLogo />
          <span className="sr-only">Splash</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Auth */}
        <div className="hidden items-center gap-3 md:flex">
          {session ? (
            <>
              <Link
                href="/projects"
                className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                대시보드
              </Link>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[var(--border-secondary)] transition-colors hover:border-[var(--accent-green)]"
                >
                  {user?.image ? (
                    <img src={user.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-[var(--accent-green)]">{initial}</span>
                  )}
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-2 shadow-lg animate-[scaleIn_150ms_ease-out]">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{user?.name ?? "사용자"}</p>
                      {user?.email && (
                        <p className="text-xs text-[var(--text-secondary)]">{user.email}</p>
                      )}
                    </div>
                    <div className="my-1 border-t border-[var(--border-primary)]" />
                    <Link
                      href="/projects"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                      onClick={() => setDropdownOpen(false)}
                    >
                      대시보드로 이동
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--accent-red)] transition-colors hover:bg-[var(--bg-tertiary)]"
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                로그인
              </Link>
              <Link
                href="/login"
                className="rounded-lg bg-[var(--accent-green)] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[var(--accent-green-hover)]"
              >
                무료로 시작하기
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="flex h-8 w-8 flex-col items-center justify-center gap-1.5 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="메뉴"
        >
          <span className={`block h-0.5 w-5 bg-[var(--text-primary)] transition-all ${mobileOpen ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`block h-0.5 w-5 bg-[var(--text-primary)] transition-all ${mobileOpen ? "opacity-0" : ""}`} />
          <span className={`block h-0.5 w-5 bg-[var(--text-primary)] transition-all ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-6 py-4 animate-[slideDown_200ms_ease-out] md:hidden">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="my-2 border-t border-[var(--border-primary)]" />
            {session ? (
              <>
                <Link
                  href="/projects"
                  className="text-sm font-medium text-[var(--text-primary)]"
                  onClick={() => setMobileOpen(false)}
                >
                  대시보드로 이동
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/" }) }}
                  className="text-left text-sm text-[var(--accent-red)]"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-[var(--text-secondary)]"
                  onClick={() => setMobileOpen(false)}
                >
                  로그인
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg bg-[var(--accent-green)] px-4 py-2 text-center text-sm font-medium text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  무료로 시작하기
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
