# Research: @-mention Autocomplete for Logo Images in React/Next.js Chat

**Date:** 2026-04-22

**Stack Context:** Next.js 15, React 19, Tailwind CSS v4, AI SDK v6, shadcn-style components, pnpm

---

## Executive Summary

Implementing @-mention autocomplete for logo thumbnails with version numbers in a chat interface requires balancing bundle size, LLM interoperability, and accessibility. Based on research, the recommended approach is a **custom headless popup using cmdk + plain textarea** — avoiding heavy rich-text editors while maintaining full control over mention chip rendering. For LLM communication, use **structured `attachments` array** with image URLs alongside plain text (not inline markup), and leverage **AI SDK v6's image `ImagePart`** for multimodal inputs.

---

## 1. Library Options for @-mention Autocomplete

### 1.1 @tiptap/extension-mention (Rich Text Based)

| Aspect | Details |
|--------|---------|
| **Bundle Size** | ~75.6 KB unpacked (extension-mention alone, requires @tiptap/core, @tiptap/pm) |
| **Maintenance** | Active — 2.8M weekly downloads, latest release Apr 2026 |
| **Pros** | Full rich-text editor integration, multiple trigger support (@, #), customizable rendering, collaboration-ready |
| **Cons** | Heavy — pulls in ProseMirror engine, overkill for chat input, requires contentEditable |
| **Image Mentions** | Custom renderHTML can display images in dropdown and inline |

**Verdict:** Too heavy for a chat textarea. Only use if you already have Tiptap as a rich-text editor elsewhere.

---

### 1.2 react-mentions

| Aspect | Details |
|--------|---------|
| **Bundle Size** | ~40 KB (gzipped ~13 KB) |
| **Maintenance** | Declining activity, last commit "over a year ago", 2.6K GitHub stars |
| **Pros** | Lightweight, textarea-based, easy setup, customizable item rendering |
| **Cons** | No native TypeScript types (community types available), limited customization for complex mention chips (thumbnails), no built-in rich content support |
| **Image Mentions** | Can render custom components in suggestion list, but limited for inline chips |

**Verdict:** Popular but showing age. Works for simple text mentions, less ideal for image thumbnails with version labels.

---

### 1.3 Lexical (Meta's Editor) with Mentions Plugin

| Aspect | Details |
|--------|---------|
| **Bundle Size** | Large (~100+ KB) — full editor framework |
| **Maintenance** | Active — Meta-maintained, part of shadcn/editor |
| **Pros** | Full rich-text editing, accessible mentions plugin from shadcn/editor |
| **Cons** | Massive for chat input, requires contentEditable |
| **Image Mentions** | Can render custom nodes for image mentions |

**Verdict:** Use only if building a full document editor. Not suitable for chat composer.

---

### 1.4 cmdk (Headless Command Menu)

| Aspect | Details |
|--------|---------|
| **Bundle Size** | ~5 KB minified |
| **Maintenance** | Active — 12K GitHub stars, maintained by Paco Coursey (Vercel) |
| **Pros** | Extremely lightweight, fully composable, accessible, works as combobox/autocomplete, works with any input (not tied to textarea), Tailwind-native |
| **Cons** | No input handling — you build the trigger logic yourself |
| **Image Mentions** | Custom Command.Item rendering with thumbnails, labels, version numbers |

**Verdict:** **Recommended.** Lightweight, flexible, works perfectly with shadcn/ui integration.

---

### 1.5 downshift / Custom Headless Popup

| Aspect | Details |
|--------|---------|
| **downshift** | ~30 KB, React-based combobox primitives, flexible but verbose |
| **Custom + Popover** | Build from scratch using Radix UI Popover + your own filtering logic |
| **Pros** | Full control, minimal bundle |
| **Cons** | More implementation work |

**Verdict:** cmdk is the sweet spot — provides filtering, keyboard nav, accessibility without the overhead.

---

### 1.6 AI SDK Chat Examples (shadcn)

shadcn/ui provides a **Chat Mention Autocomplete** block that demonstrates the pattern:

- Uses `Popover` + custom input logic
- Renders inline styled spans with subtle blue highlight for mentions
- Type "@" triggers filterable dropdown with avatars/roles
- Built for Next.js + TypeScript + Tailwind

Reference: https://www.shadcn.io/blocks/chat-mention-autocomplete

**Verdict:** Use this as a reference implementation pattern, not as a library to install.

---

## Recommendation: cmdk + Custom Trigger Logic

For your logo mention use case:

```tsx
// components/LogoMentionInput.tsx
import { useState, useCallback, useRef, useEffect } from 'react'
import { Command } from 'cmdk'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import { LogoChip } from './LogoChip'

interface Logo {
  id: string
  thumbnailUrl: string
  version: number
  name: string
}

interface LogoMentionInputProps {
  logos: Logo[]
  onSend: (text: string, attachments: { type: 'logo'; logoId: string; version: number }[]) => void
}

export function LogoMentionInput({ logos, onSend }: LogoMentionInputProps) {
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedLogos, setSelectedLogos] = useState<Logo[]>([])
  const [query, setQuery] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Detect @ trigger and extract query
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursor = e.target.selectionStart
    const textBeforeCursor = value.slice(0, cursor)
    const atMatch = textBeforeCursor.match(/@(\w*)$/)

    if (atMatch) {
      setQuery(atMatch[1])
      setIsOpen(true)
    } else {
      setIsOpen(false)
      setQuery('')
    }
    setInput(value)
  }, [])

  const filteredLogos = logos.filter(l =>
    l.name.toLowerCase().includes(query.toLowerCase()) ||
    l.id.toLowerCase().includes(query.toLowerCase())
  )

  const selectLogo = useCallback((logo: Logo) => {
    const cursor = textareaRef.current?.selectionStart ?? input.length
    const textBeforeCursor = input.slice(0, cursor)
    const textAfterCursor = input.slice(cursor)
    const atIndex = textBeforeCursor.lastIndexOf('@')

    const newText = textBeforeCursor.slice(0, atIndex) +
      `[@${logo.name} v${logo.version}](logo:${logo.id})` +
      textAfterCursor

    setInput(newText)
    setSelectedLogos([...selectedLogos, logo])
    setIsOpen(false)
    textareaRef.current?.focus()
  }, [input, selectedLogos])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Korean IME compatibility
    if (e.nativeEvent.isComposing) return

    if (e.key === 'Enter' && !e.shiftKey && !isOpen) {
      e.preventDefault()
      onSend(input, selectedLogos.map(l => ({ type: 'logo' as const, logoId: l.id, version: l.version })))
      setInput('')
      setSelectedLogos([])
    }
  }, [input, selectedLogos, isOpen, onSend])

  return (
    <div className="relative">
      {/* Render selected chips above textarea */}
      {selectedLogos.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedLogos.map(logo => (
            <LogoChip key={logo.id} logo={logo} onRemove={() => {
              setSelectedLogos(selectedLogos.filter(l => l.id !== logo.id))
            }} />
          ))}
        </div>
      )}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverAnchor asChild>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            className="w-full min-h-[80px] p-3 border rounded-lg resize-none"
            placeholder="Type @ to mention a logo..."
          />
        </PopoverAnchor>
        <PopoverContent className="p-0" align="start">
          <Command>
            <CommandList>
              {filteredLogos.map(logo => (
                <CommandItem
                  key={logo.id}
                  onSelect={() => selectLogo(logo)}
                  className="flex items-center gap-3 p-2 cursor-pointer"
                >
                  <img src={logo.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
                  <div>
                    <div className="font-medium">{logo.name}</div>
                    <div className="text-sm text-muted-foreground">v{logo.version}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
```

---

## 2. Textarea vs contentEditable — Tradeoffs

### Plain `<textarea>`

| Pros | Cons |
|------|------|
| Simple, predictable behavior | No inline rich content (chips must be rendered separately) |
| Native keyboard handling, IME support | No visual mention chips in input |
| Lightweight, no extra DOM manipulation | Harder to position popup near cursor |
| Works with native form submission | |

### `contentEditable` `<div>`

| Pros | Cons |
|------|------|
| Inline rich content (chips, images) | Complex selection/cursor management |
| Native cursor positioning for popup | Browser inconsistencies in behavior |
| Can render chips directly in input | IME composition issues more prevalent |
| Full control over DOM | Security concerns (XSS), paste handling |

### How ChatGPT/Claude/Cursor Represent File Mentions

Based on research:

- **Claude API:** Uses a dedicated `file_id` reference system with the Files API — upload once, reference by ID in messages. Images are uploaded and referenced as `file_id` in content blocks.

- **Claude Code (Desktop):** Stores session data in JSONL files with structured message formats. Mentions (files) are tracked via metadata, not inline text tokens.

- **ChatGPT:** Uses a separate attachments system — files/images are stored separately from text, sent as structured data alongside the message, not embedded in text.

**Pattern:** All major AI interfaces treat file/image mentions as **separate structured attachments**, not inline text tokens.

---

## Recommendation: Plain Textarea + Separate Attachments

For your use case:

- Use a **plain `<textarea>`** for input
- Track selected logos in **separate state** (`selectedLogos[]`)
- Render selected logos as **chips above the textarea** (not inline within text)
- Send to backend as: `{ text: string, attachments: LogoAttachment[] }`

This avoids contentEditable complexity while maintaining good UX.

---

## 3. Wire Format: Encoding Mentions for Backend/LLM

### Options Compared

| Format | Example | Pros | Cons |
|--------|---------|------|------|
| **Markdown-ish** | `@[Logo Name v2](logo:logo_123)` | Readable, parseable | LLM may not understand custom syntax |
| **Custom token** | `<mention id="logo_xxx" version="2"/>` | Structured, parseable | Non-standard, may confuse LLM |
| **Separate attachments** | `{ text: "Edit this", attachments: [{ type: "logo", id: "logo_123", version: 2 }] }` | Clean separation, LLM-friendly | Requires structured message handling |

### Recommendation: Separate `attachments[]` Array

```typescript
// Frontend sends
{
  text: "Can you edit this logo?",
  attachments: [
    { type: 'logo', logoId: 'logo_abc123', version: 2 }
  ]
}

// Backend converts to AI SDK message
{
  role: 'user',
  content: [
    { type: 'text', text: 'Can you edit this logo?' },
    // Option A: Describe in text (simple, works everywhere)
    { type: 'text', text: '[Referencing logo: logo_abc123 v2 - https://storage.url/logo_abc123_v2.png]' },
    // Option B: Send as image part (if model supports it)
    { type: 'image', image: 'https://storage.url/logo_abc123_v2.png' }
  ]
}
```

**Why this is LLM-friendly:**

1. Plain text describes what the attachment is
2. LLM can reference the attachment by description
3. No custom parsing required — it's just text
4. Can upgrade to multimodal image parts without changing format

---

## 4. Passing Logo Images to the LLM

### AI SDK v6 Image Input Support

AI SDK v6 supports `ImagePart` in messages:

```typescript
import { generateText } from 'ai'

const result = await generateText({
  model: google('gemini-2.5-flash-image'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Edit this logo to have a brighter color' },
        {
          type: 'image',
          image: 'https://storage.vercel.app/logos/logo_abc123_v2.png'
          // Also supports: base64 string, Uint8Array, Buffer, URL
        }
      ]
    }
  ]
})
```

**Supported formats for `image`:**
- URL string (https://...)
- base64 encoded string
- base64 data URL (`data:image/png;base64,...`)
- `Uint8Array`
- `Buffer` (Node.js)
- `ArrayBuffer`

### Via OpenRouter to Gemini

Yes, you can pass image URLs through OpenRouter to Gemini:

```typescript
import { openrouter } from '@ai-sdk/openrouter'
import { generateText } from 'ai'

const result = await generateText({
  model: openrouter('google/gemini-2.5-flash-image'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Edit this logo' },
        { type: 'image', image: logoUrl }
      ]
    }
  ]
})
```

**Verification:** OpenRouter passes through multimodal content to Gemini models. The AI SDK documentation confirms image parts work with compatible models.

### Recommendation

For the backend chat endpoint:

1. Extract `attachments[]` from the incoming message
2. For each logo attachment, fetch the image (or use stored URL)
3. Convert to AI SDK message parts:

```typescript
// Backend: convert to ModelMessage (AI SDK v6)
function toModelMessage(msg: ChatMessage): ModelMessage {
  const parts: CoreMessageContent = []

  if (msg.text) {
    parts.push({ type: 'text', text: msg.text })
  }

  for (const attachment of msg.attachments ?? []) {
    if (attachment.type === 'logo') {
      const logoUrl = getLogoUrl(attachment.logoId, attachment.version)
      // Option 1: Just describe (safe, always works)
      parts.push({
        type: 'text',
        text: `[Logo reference: ${attachment.logoId} v${attachment.version}]`
      })
      // Option 2: Send as image (if multimodal)
      parts.push({
        type: 'image',
        image: logoUrl
      })
    }
  }

  return { role: msg.role, content: parts }
}
```

**Recommendation:** Start with Option 1 (text description) for reliability. Enable Option 2 (image parts) once you verify OpenRouter + Gemini handles it correctly.

---

## 5. Rendering Sent Messages with Mention Chips

### Chat History Rendering Pattern

```tsx
// components/ChatMessage.tsx
interface ChatMessageProps {
  message: {
    id: string
    text: string
    attachments?: { type: 'logo'; logoId: string; version: number; thumbnailUrl: string }[]
    sender: 'user' | 'assistant'
    timestamp: Date
  }
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${message.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-muted'}`}>
        {/* Render attachments as chips first */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 p-2 border-b border-white/20">
            {message.attachments.map((att, i) => (
              <LogoChip
                key={`${att.logoId}-${att.version}-${i}`}
                logo={{ id: att.logoId, version: att.version, thumbnailUrl: att.thumbnailUrl }}
                variant={message.sender === 'user' ? 'light' : 'default'}
              />
            ))}
          </div>
        )}

        {/* Then render text */}
        <div className="p-3 whitespace-pre-wrap">{message.text}</div>

        <div className="text-xs opacity-70 px-3 pb-2">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}

// components/LogoChip.tsx
interface LogoChipProps {
  logo: { id: string; thumbnailUrl: string; version: number; name?: string }
  onRemove?: () => void
  variant?: 'default' | 'light'
}

export function LogoChip({ logo, onRemove, variant = 'default' }: LogoChipProps) {
  const baseStyles = variant === 'light'
    ? 'bg-white/20 text-white border-white/30'
    : 'bg-blue-50 border-blue-200'

  return (
    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full border ${baseStyles}`}>
      <img src={logo.thumbnailUrl} alt="" className="w-5 h-5 rounded object-cover" />
      <span className="text-sm font-medium">v{logo.version}</span>
      {onRemove && (
        <button onClick={onRemove} className="ml-1 hover:opacity-70">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
```

---

## 6. Accessibility + Korean IME Compatibility

### The Korean IME Problem

When typing Korean in a textarea and pressing Enter to submit:
- Without protection, the message submits with the Korean character duplicated
- This is because Korean IME (Hangul) uses composition events

### Solution: Check `isComposing`

```tsx
const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  // Critical for Korean IME users
  if (e.nativeEvent.isComposing) return

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}, [handleSend])

// Also handle composition events for broader compatibility
const handleComposition = useCallback((e: React.CompositionEvent<HTMLTextAreaElement>) => {
  // Could track composition state here if needed
}, [])
```

### Accessibility Requirements

1. **Keyboard navigation:** The popup must be navigable with Arrow keys, Enter to select, Escape to close
2. **ARIA attributes:** Use `aria-expanded`, `aria-activedescendant`, `aria-haspopup`
3. **Screen reader:** Announce when popup opens, announce selected item

cmdk handles most of this automatically. For the popup:

```tsx
<Command
  aria-label="Logo mentions"
  shouldFilter={true}
>
  <CommandList aria-live="polite">
    {filteredLogos.map((logo, index) => (
      <CommandItem
        key={logo.id}
        value={`${logo.name} ${logo.version}`}
        onSelect={() => selectLogo(logo)}
        aria-selected={index === selectedIndex}
      >
        {/* ... */}
      </CommandItem>
    ))}
  </CommandList>
</Command>
```

---

## 7. Recommendation Summary

### Recommended Architecture

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Input** | Plain `<textarea>` + cmdk popup | Lightweight, no contentEditable complexity |
| **Mention UI** | Custom `LogoChip` components rendered above textarea | Clean separation, easy to manage |
| **Wire format** | `{ text, attachments[] }` | LLM-friendly, matches AI SDK patterns |
| **LLM images** | Text description + optional ImagePart | Reliable, upgradeable |
| **Rendering** | Separate chips above text in chat history | Consistent with input UX |
| **IME** | Check `e.nativeEvent.isComposing` | Korean user compatibility |

### Implementation Sequence

1. **Phase 1:** Build `LogoMentionInput` with cmdk + textarea (1-2 days)
2. **Phase 2:** Build `LogoChip` and `ChatMessage` rendering (half day)
3. **Phase 3:** Wire up backend to convert attachments to message parts (half day)
4. **Phase 4:** Test Korean IME, accessibility, multimodal image inputs (1 day)

### What to Avoid

- ❌ Tiptap/Lexical — too heavy for chat composer
- ❌ contentEditable — adds unnecessary complexity
- ❌ Inline markup in text — LLM-unfriendly
- ❌ Building popup positioning from scratch — use cmdk or Radix Popover

---

## 8. Reference Links

- **cmdk:** https://cmdk.paco.me / https://github.com/pacocoursey/cmdk
- **shadcn Chat Mention:** https://www.shadcn.io/blocks/chat-mention-autocomplete
- **AI SDK v6 Image Parts:** https://v6.ai-sdk.dev/docs/ai-sdk-core/generate-text
- **Korean IME Fix:** https://jik-k.github.io/react/2024/06/27/ReactIsComposing.html
- **Tiptap Mention:** https://tiptap.dev/docs/editor/api/nodes/mention
- **React Mentions:** https://github.com/signavio/react-mentions
- **Claude Files API:** https://platform.claude.com/docs/en/api/beta/files