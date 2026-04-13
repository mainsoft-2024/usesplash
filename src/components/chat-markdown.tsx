"use client"

import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"

export type ChatMarkdownVariant = "assistant" | "user"

type ChatMarkdownProps = {
  content: string
  /** Kept for API compatibility; layout is unified (flat thread). */
  variant?: ChatMarkdownVariant
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  const trimmed = content.trim()
  if (!trimmed) return null

  const linkClass =
    "font-medium text-[var(--accent-green-light)] underline decoration-[var(--border-secondary)] underline-offset-[3px] hover:text-[var(--accent-green)]"

  const components: Partial<Components> = {
    a: ({ href, children }) => (
      <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
    p: ({ children }) => (
      <p className="mb-3 text-[#e6e6e6] last:mb-0 [overflow-wrap:anywhere]">{children}</p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
    ),
    em: ({ children }) => <em className="text-[#cfcfcf]">{children}</em>,
    ul: ({ children }) => (
      <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[#e0e0e0] last:mb-0 marker:text-[var(--text-tertiary)]">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-[#e0e0e0] last:mb-0 marker:text-[var(--text-tertiary)]">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="ps-0.5 [overflow-wrap:anywhere]">{children}</li>,
    h1: ({ children }) => (
      <h1 className="mb-2 mt-1 text-lg font-bold tracking-tight text-[var(--text-primary)] first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-2 mt-3 text-base font-semibold tracking-tight text-[var(--text-primary)] first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-1.5 mt-2.5 text-[0.95rem] font-semibold text-[#f0f0f0] first:mt-0">{children}</h3>
    ),
    h4: ({ children }) => <h4 className="mb-1.5 mt-2 text-sm font-semibold text-[#eaeaea] first:mt-0">{children}</h4>,
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-2 border-[var(--accent-green)]/50 pl-3 italic text-[var(--text-secondary)]">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-4 border-0 border-t border-[var(--border-primary)]" />,
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-deep)]">
        <table className="w-full min-w-[280px] border-collapse text-left text-[0.8125rem]">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">{children}</thead>,
    tbody: ({ children }) => <tbody className="divide-y divide-[var(--border-primary)]">{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => (
      <th className="whitespace-nowrap px-3 py-2 font-medium text-[var(--text-primary)] first:rounded-tl-xl last:rounded-tr-xl">
        {children}
      </th>
    ),
    td: ({ children }) => <td className="px-3 py-2 text-[#d6d6d6] [overflow-wrap:anywhere]">{children}</td>,
    pre: ({ children }) => (
      <pre className="chat-md-pre my-3 overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-deep)] p-3.5 text-[0.8125rem] leading-relaxed text-[#e8e8e8]">
        {children}
      </pre>
    ),
    code: ({ className, children }) => (
      <code className={`chat-md-code font-mono text-[0.85em] ${className ?? ""}`.trim()}>{children}</code>
    ),
    img: ({ src, alt }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ""} className="my-2 max-h-48 max-w-full rounded-lg border border-[var(--border-primary)] object-contain" />
    ),
  }

  return (
    <div className="chat-md text-[0.9375rem] leading-relaxed [word-break:break-word]">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {trimmed}
      </ReactMarkdown>
    </div>
  )
}
