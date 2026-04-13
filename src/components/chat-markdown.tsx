"use client"

import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"

export type ChatMarkdownVariant = "assistant" | "user"

type ChatMarkdownProps = {
  content: string
  variant: ChatMarkdownVariant
}

export function ChatMarkdown({ content, variant }: ChatMarkdownProps) {
  const trimmed = content.trim()
  if (!trimmed) return null

  const isUser = variant === "user"

  const linkClass = isUser
    ? "font-medium text-zinc-950 underline decoration-zinc-950/35 underline-offset-[3px] hover:decoration-zinc-950/60"
    : "font-medium text-[var(--accent-green-light)] underline decoration-[var(--border-secondary)] underline-offset-[3px] hover:text-[var(--accent-green)]"

  const inlineCodeClass = isUser
    ? "rounded-md bg-black/15 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-900"
    : "rounded-md bg-[var(--bg-deep)] px-1.5 py-0.5 font-mono text-[0.85em] text-[#d0d0d0] ring-1 ring-[var(--border-primary)]"

  const components: Partial<Components> = {
    a: ({ href, children }) => (
      <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
    p: ({ children }) => (
      <p className={`mb-3 last:mb-0 [overflow-wrap:anywhere] ${isUser ? "text-zinc-950" : "text-[#e6e6e6]"}`}>{children}</p>
    ),
    strong: ({ children }) => (
      <strong className={isUser ? "font-semibold text-zinc-950" : "font-semibold text-[var(--text-primary)]"}>{children}</strong>
    ),
    em: ({ children }) => (
      <em className={isUser ? "text-zinc-900/95" : "text-[#cfcfcf]"}>{children}</em>
    ),
    ul: ({ children }) => (
      <ul
        className={`mb-3 list-disc pl-5 last:mb-0 marker:text-[var(--text-tertiary)] ${
          isUser ? "text-zinc-950" : "text-[#e0e0e0]"
        } space-y-1.5`}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={`mb-3 list-decimal pl-5 last:mb-0 marker:text-[var(--text-tertiary)] ${
          isUser ? "text-zinc-950" : "text-[#e0e0e0]"
        } space-y-1.5`}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="ps-0.5 [overflow-wrap:anywhere]">{children}</li>,
    h1: ({ children }) => (
      <h1
        className={`mb-2 mt-1 text-lg font-bold tracking-tight first:mt-0 ${isUser ? "text-zinc-950" : "text-[var(--text-primary)]"}`}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className={`mb-2 mt-3 text-base font-semibold tracking-tight first:mt-0 ${isUser ? "text-zinc-950" : "text-[var(--text-primary)]"}`}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className={`mb-1.5 mt-2.5 text-[0.95rem] font-semibold first:mt-0 ${isUser ? "text-zinc-950" : "text-[#f0f0f0]"}`}
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className={`mb-1.5 mt-2 text-sm font-semibold first:mt-0 ${isUser ? "text-zinc-950" : "text-[#eaeaea]"}`}>{children}</h4>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className={`my-3 border-l-2 pl-3 italic ${
          isUser
            ? "border-zinc-950/30 text-zinc-900/90"
            : "border-[var(--accent-green)]/50 text-[var(--text-secondary)]"
        }`}
      >
        {children}
      </blockquote>
    ),
    hr: () => <hr className={`my-4 border-0 border-t ${isUser ? "border-zinc-950/15" : "border-[var(--border-primary)]"}`} />,
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
      <pre className="my-3 overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-deep)] p-3.5 text-[0.8125rem] leading-relaxed">
        {children}
      </pre>
    ),
    code: ({ className, children, ...props }) => {
      const isBlock = "inline" in props && props.inline === false
      if (isBlock) {
        return <code className={`block font-mono text-[#e8e8e8] ${className ?? ""}`.trim()}>{children}</code>
      }
      return <code className={inlineCodeClass}>{children}</code>
    },
    img: ({ src, alt }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ""} className="my-2 max-h-48 max-w-full rounded-lg border border-[var(--border-primary)] object-contain" />
    ),
  }

  return (
    <div className="text-[0.9375rem] leading-relaxed [word-break:break-word]">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {trimmed}
      </ReactMarkdown>
    </div>
  )
}
