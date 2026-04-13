import Link from "next/link"

export function SharedFooter() {
  return (
    <footer className="border-t border-[var(--border-primary)] bg-[var(--bg-deep)]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Col 1: Brand */}
          <div>
            <Link href="/" className="text-xl font-bold">
              Sp<span className="text-[var(--accent-green)]">lash</span>
            </Link>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              AI 기반 로고 디자인 스튜디오
            </p>
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              © 2026 Splash. All rights reserved.
            </p>
          </div>

          {/* Col 2: 제품 */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">제품</h3>
            <ul className="space-y-2">
              <li><Link href="/#how" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">작동 방식</Link></li>
              <li><Link href="/#features" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">기능</Link></li>
              <li><Link href="/pricing" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">요금제</Link></li>
            </ul>
          </div>

          {/* Col 3: 회사 */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">회사</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">소개</Link></li>
              <li><a href="mailto:hello@usesplash.vercel.app" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">연락처</a></li>
            </ul>
          </div>

          {/* Col 4: 지원 */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">지원</h3>
            <ul className="space-y-2">
              <li><Link href="/faq" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">FAQ</Link></li>
              <li><Link href="/terms" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">이용약관</Link></li>
              <li><Link href="/terms" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">개인정보처리방침</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
