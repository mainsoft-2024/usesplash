# Research: Vercel AI SDK v6 Chat Persistence with `useChat`

**Date:** 2026-04-13

## Summary

AI SDK v6 (release December 2025) uses a **transport-based architecture** with a new parts-based message format (`UIMessage` with `parts: UIPart[]`). The `messages` prop in `useChat` is **initial-only** - it sets the initial messages but does not create a controlled component. For async loading, you must use `setMessages` after the data loads. The `id` prop enables session sharing across components when they share the same ID. The recommended pattern uses server-side loading in a Next.js page, passing `initialMessages` to the client component, with the API route loading history from the DB.

---

## Findings

### 1. How does the `messages` prop work in `useChat`? Is it initial-only or controlled?

**Answer: Initial-only** (not controlled).

The `messages` prop has this description in official docs:

> **messages**: `UIMessage[]` — Initial chat messages to populate the conversation with.

**Evidence** ([AI SDK useChat reference](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)):
```
{
  name: 'messages',
  type: 'UIMessage[]',
  isOptional: true,
  description: 'Initial chat messages to populate the conversation with.',
},
```

The pattern shows it's passed at initialization time:

**Evidence** ([Context7 chatbot example](https://github.com/vercel/ai/blob/main/content/docs/04-ai-sdk-ui/03-chatbot-message-persistence.mdx)):
```typescript
export default function Chat({
  id,
  initialMessages,
}: { id?: string | undefined; initialMessages?: UIMessage[] } = {}) {
  const { sendMessage, messages } = useChat({
    id,
    messages: initialMessages, // used at initialization
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
}
```

The property is named `messages` in AI SDK v5/v6 (was `initialMessages` in v4).

**Evidence** ([Migration guide](https://github.com/vercel/ai/blob/main/content/docs/08-migration-guides/26-migration-guide-5-0.mdx)):
> Updated useChat configuration using messages parameter with UIMessage type. The parameter name and type have both changed from AI SDK 4.0.

---

### 2. How to load existing messages from a database and show them in the chat

**Recommended Pattern: Server-side loading in the page, pass to client component.**

The official recommendation is to load messages on the server (in the page component) and pass them as `initialMessages` to the chat component:

**Evidence** ([Official chatbot persistence guide](https://github.com/vercel/ai/blob/main/content/docs/04-ai-sdk-ui/03-chatbot-message-persistence.mdx)):
```typescript
// app/chat/[id]/page.tsx - Server component
import { loadChat } from '@util/chat-store';
import Chat from '@ui/chat';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const messages = await loadChat(id); // Load from DB on server
  return <Chat id={id} initialMessages={messages} />;
}

// ui/chat.tsx - Client component
'use client';
import { UIMessage, useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Chat({
  id,
  initialMessages,
}: { id?: string; initialMessages?: UIMessage[] }) {
  const { sendMessage, messages } = useChat({
    id,
    messages: initialMessages, // Populates the chat with existing messages
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  // ...
}
```

The database can be implemented with file storage (demo), Redis (Upstash blog), or PostgreSQL/Drizzle (official persistence example).

**Evidence** ([vercel-labs/ai-sdk-persistence-db](https://github.com/vercel-labs/ai-sdk-persistence-db)):
```typescript
// Database schema with prefix-based part storage
export const messages = pgTable("messages", {
  id: varchar().primaryKey().$defaultFn(() => nanoid()),
  chatId: varchar().references(() => chats.id),
  role: roleEnum,
  createdAt: timestamp().defaultNow(),
  // Prefix-based columns for parts
  textContent: text('text_content'),
  reasoningContent: text('reasoning_content'),
  // Tool-specific columns prefixed with tool_[toolName]_
});
```

---

### 3. How to properly handle the case where messages are loaded async (from tRPC/API) and need to be set after mount

**Two options exist:**

**Option A: Use server-side rendering** (recommended) - Let the page load data before rendering the client component, as shown in question 2.

**Option B: Client-side loading with `setMessages`**

When you must load on the client after mount, use `setMessages` (not the `messages` prop) to populate after the async data arrives:

**Evidence** ([Community discussion](https://community.vercel.com/t/how-to-load-messages-on-client-side-using-shared-chat-context/29579)):
```typescript
// Using useQuery (TanStack Query) + setMessages
const { data, isSuccess } = useQuery({
  queryKey: ["chatHistory", id],
  queryFn: () => getChatHistory(id!),
});

useEffect(() => {
  if (isSuccess && data) {
    // Use setMessages to populate after async load
    setMessages(data.messages);
  }
}, [isSuccess, data, setMessages]);
```

The key is calling `setMessages()` (not just passing `messages` prop) because the `messages` prop is initial-only.

Additionally, you can combine fetching with the `Chat` class for more control:

**Evidence** ([Community chat context solution](https://community.vercel.com/t/how-to-load-messages-on-client-side-using-shared-chat-context/29579)):
```typescript
const createChat = (opts: ChatOptsType) => new Chat<UIMessage>(opts);

// In provider
const [chat, setChat] = useState(() => createChat(chatOpts));

const { data, isSuccess } = useQuery({
  queryKey: ["chatHistory", id],
  queryFn: () => getChatHistory(id!),
});

useEffect(() => {
  if (isSuccess && data) {
    // Create new chat with loaded messages
    const newChat = createChat({
      ...chatOpts,
      messages: data.messages,
    });
    setChat(newChat);
  }
}, [isSuccess, data, chatOpts]);
```

This approach uses the `Chat` class (exposed in AI SDK v5+) directly rather than just the `useChat` hook.

---

### 4. Is there a `setMessages` function available?

**Yes**, `setMessages` is provided by `useChat`.

**Evidence** ([Official chatbot docs](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)):
```typescript
{
  name: 'setMessages',
  type: '(messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => void',
  description: 'Function to update the messages state locally without triggering an API call. Useful for optimistic updates.',
}
```

**Usage example** - Deleting messages:

**Evidence** ([Official chatbot docs](https://v6.ai-sdk.dev/docs/ai-sdk-ui/chatbot)):
```typescript
const { messages, setMessages } = useChat();

const handleDelete = (id: string) => {
  setMessages(messages.filter(message => message.id !== id));
};
```

**Evidence** (Official docs state):
> You can think of `messages` and `setMessages` as a pair of `state` and `setState` in React.

---

### 5. How does `useChat({ id })` work for session identification?

The **`id`** prop enables session sharing. When multiple components use the same `id`, they share state (messages, status) through SWR caching.

**Evidence** ([Official useChat reference](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)):
```typescript
{
  name: 'id',
  type: 'string',
  isOptional: true,
  description: 'A unique identifier for the chat. If not provided, a random one will be generated. When provided, the `useChat` hook with the same `id` will have shared states across components.',
}
```

**Important caveats:**

1. **Must pass other options consistently**: When sharing across components, you must pass the same `api` and other transport options for the shared state to work.

**Evidence** ([GitHub issue #3266](https://github.com/vercel/ai/issues/3266)):
> One have to pass both initialMessages, id and api props for it to work.

2. **Cannot change the id dynamically**: The `id` is set at initialization and cannot be changed afterward. This is by design.

**Evidence** ([GitHub issue #6992](https://github.com/vercel/ai/issues/6992), closed as by design):
> This is by design. You cannot change the id like this - the new chat parameters create an object on init. If you have dynamic ids, the normal approach is to create a new `Chat` instance.

3. **Shared state via React context**: To share `useChat` state across components, the recommended approach is creating your own React context that holds a `Chat` instance:

**Evidence** ([Official share state example](https://sdk.vercel.ai/cookbook/next/use-shared-chat-context)):
```typescript
// Create context to hold Chat instance
interface ChatContextValue {
  chat: Chat<UIMessage>;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

function createChat() {
  return new Chat<UIMessage>({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chat, setChat] = useState(() => createChat());
  const clearChat = () => setChat(createChat());

  return (
    <ChatContext.Provider value={{ chat, clearChat }}>
      {children}
    </ChatContext.Provider>
  );
}
```

---

### 6. What's the correct pattern for: load messages from DB → display them → continue chatting with new messages streamed?

**Complete pattern:**

**Step 1: Server-side page loads from DB**
```typescript
// app/chat/[id]/page.tsx
import { loadChat } from '@/lib/db/actions';
import Chat from '@/components/chat';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const messages = await loadChat(id); // Load from PostgreSQL/Drizzle
  return <Chat id={id} initialMessages={messages} />;
}
```

**Step 2: Client chat component uses initialMessages**
```typescript
// components/chat.tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export default function Chat({ id, initialMessages }: { id: string; initialMessages?: UIMessage[] }) {
  const [input, setInput] = useState('');
  
  const { messages, sendMessage } = useChat({
    id,
    messages: initialMessages, // Displays loaded history
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages, id }) => ({
        // Only send latest message; server loads history from DB
        body: { message: messages[messages.length - 1], chatId: id },
      }),
    }),
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.role}: {m.parts.map(p => p.type === 'text' ? p.text : '').join('')}
        </div>
      ))}
      <form onSubmit={e => { e.preventDefault(); sendMessage({ text: input }); }}>
        <input value={input} onChange={e => setInput(e.target.value)} />
      </form>
    </div>
  );
}
```

**Step 3: API route loads history and processes**
```typescript
// app/api/chat/route.ts
import { loadChat, upsertMessage } from '@/lib/db/actions';
import { streamText, createUIMessageStream, convertToModelMessages } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { message, chatId } = await req.json();

  // Persist the new user message
  await upsertMessage({ id: message.id, chatId, message });

  // Load all previous messages
  const messages = await loadChat(chatId);

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const result = streamText({
        model: openai('gpt-4o-mini'),
        messages: convertToModelMessages(messages),
      });
      writer.merge(result.toUIMessageStream({ sendStart: false }));
    },
    onFinish: async ({ responseMessage }) => {
      // Persist assistant response
      await upsertMessage({ id: responseMessage.id, chatId, message: responseMessage });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

This pattern has key benefits:

1. **Server-side initial load**: Messages are loaded in the server page, ensuring they're available on first render (no loading spinner)
2. **Optimized API payloads**: Only the latest message is sent to the API; the server loads history from the database
3. **Persistence**: Both user and assistant messages are persisted via `upsertMessage` in the API route
4. **Streaming**: Responses stream back in real-time using `createUIMessageStream`

---

## Key Takeaways

| Question | Answer |
|---|---|
| `messages` prop behavior | **Initial-only** - sets initial state, not controlled |
| Loading from DB | Server-side in page component, pass as `initialMessages` |
| Async client load | Use `setMessages()` in `useEffect` after data loads |
| `setMessages` available? | **Yes** - returned by `useChat` |
| `id` prop | Session identifier for shared state across components; set at init, cannot change |
| Complete pattern | Server load → `initialMessages` → API sends only new message → server loads full history |

---

## References

- [AI SDK useChat Reference](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)
- [Official Chatbot Message Persistence Guide](https://github.com/vercel/ai/blob/main/content/docs/04-ai-sdk-ui/03-chatbot-message-persistence.mdx)
- [vercel-labs/ai-sdk-persistence-db](https://github.com/vercel-labs/ai-sdk-persistence-db) - PostgreSQL/Drizzle example
- [Share useChat State Across Components](https://sdk.vercel.ai/cookbook/next/use-shared-chat-context)
- [AI SDK v6 Release Blog](https://vercel.com/blog/ai-sdk-6) (December 2025)
- [Community: Loading messages on client side](https://community.vercel.com/t/how-to-load-messages-on-client-side-using-shared-chat-context/29579)