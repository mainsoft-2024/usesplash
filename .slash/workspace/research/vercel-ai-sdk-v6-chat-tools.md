# Research: Vercel AI SDK v6 Chat with Tools

Date: 2026-04-13

## Summary
Vercel AI SDK v6 provides a streamlined API for building chat applications with multi-step tool calling. Key patterns include: `streamText` with `tool()` for server-side execution, `useChat` hook with parts-based message rendering, and `createOpenRouter` for provider abstraction. The parts-based message format replaced the older step-based format in v5+.

---

## 1. Server-side `streamText` with Tools

### Defining Tools with `tool()`

```typescript
import { streamText, tool, convertToModelMessages, isStepCount } from 'ai';
import { z } from 'zod';

const tools = {
  getWeather: tool({
    description: 'Get the weather for a location',
    inputSchema: z.object({
      city: z.string().describe('The city to get the weather for'),
      unit: z.enum(['C', 'F']).describe('Temperature unit'),
    }),
    execute: async ({ city, unit }) => {
      return `It is currently 72°F and sunny in ${city}!`;
    },
  }),
};
```

**Evidence** ([vercel/ai](https://github.com/vercel/ai/blob/main/content/docs/03-ai-sdk-core/15-tools-and-tool-calling.mdx)):

> Use the tool helper to define schemas and execution logic for model-driven tasks.

### Enabling Multi-Step Tool Calling

```typescript
import { streamText, convertToModelMessages, isStepCount } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openrouter('openai/gpt-4o'),
    messages: await convertToModelMessages(messages),
    tools: tools,
    stopWhen: isStepCount(5),  // Allow up to 5 tool-call steps
  });

  return result.toUIMessageStreamResponse();
}
```

**Key point**: `stopWhen: isStepCount(5)` allows the model to automatically call tools, receive results, and continue generating — no manual loop needed.

**Evidence** ([vercel/ai](https://github.com/vercel/ai/blob/main/content/docs/04-ai-sdk-ui/03-chatbot-tool-usage.mdx)):

> Use streamText with tools that have execute functions to enable server-side multi-step tool execution.

---

## 2. Client `useChat` Hook

### Basic Setup

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  const { messages, sendMessage, input, setInput } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.parts.map(p => /* render */)}</div>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={() => sendMessage(input)}>Send</button>
    </div>
  );
}
```

### Sending Messages

The hook provides `sendMessage(content)` or use the input/button pattern:

```typescript
const { messages, sendMessage, input, setInput } = useChat();

// Option 1: Manual send
sendMessage('What is the weather in Tokyo?');

// Option 2: Input + button (from docs)
<input value={input} onChange={e => setInput(e.target.value)} />
<button onClick={() => sendMessage(input)}>Send</button>
```

---

## 3. Rendering Tool Calls with `msg.parts`

### Parts-Based Message Format

Messages contain a `parts` array with different part types:

```typescript
message.parts.map((part, i) => {
  switch (part.type) {
    case 'text':
      return <p key={i}>{part.text}</p>;
    case 'tool-invocation':
      return <div key={i}>{part.toolInvocation.toolName}</div>;
    case 'tool-getWeather':  // typed tool parts
      return <div key={i}>{/* tool-specific */}</div>;
  }
});
```

**Evidence** ([vercel/ai](https://github.com/vercel/ai/blob/main/content/docs/08-migration-guides/27-migration-guide-4-2.mdx)):

> Complete React component demonstrating how to use the useChat hook with the new message parts array structure.

### Tool Invocation States

Tool parts have a `state` property indicating progress:

```typescript
case 'tool-getWeather':
  switch (part.state) {
    case 'input-streaming':
      return <div>Loading input...</div>;
    case 'input-available':
      return <pre>{JSON.stringify(part.input)}</pre>;
    case 'output-available':
      return <pre>{JSON.stringify(part.output)}</pre>;
    case 'output-error':
      return <div>Error: {part.errorText}</div>;
  }
```

**Evidence** ([vercel/ai](https://github.com/vercel/ai/blob/main/content/docs/04-ai-sdk-ui/03-chatbot-tool-usage.mdx)):

> Use the useChat hook to access partial tool calls and render UI based on the tool part's state property.

### Rendering with Typed Tool Names

Use `tool-{toolName}` for type-safe rendering:

```typescript
case 'tool-getWeather': {
  const callId = part.toolCallId;
  switch (part.state) {
    case 'input-available':
      return <div>Getting weather for {part.input.city}...</div>;
    case 'output-available':
      return (
        <div className="weather-card">
          {part.output.temperature}°{part.output.unit}
        </div>
      );
  }
}
```

---

## 4. OpenRouter Provider

### Basic Setup

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Use with streamText
const result = streamText({
  model: openrouter('openai/gpt-4o'),
  messages,
  tools,
});
```

### Provider Options

```typescript
const model = openrouter('meta-llama/llama-3.1-70b-instruct', {
  provider: {
    order: ['together', 'fireworks', 'lepton'],
    allow_fallbacks: true,
    require_parameters: true,
    data_collection: 'deny',
    sort: 'price',
    max_price: { prompt: 0.001, completion: 0.002 },
  },
});
```

**Evidence** ([openrouterteam/ai-sdk-provider](https://context7.com/openrouterteam/ai-sdk-provider/llms.txt)):

> The createOpenRouter function is the primary way to initialize the provider.

### Extra Body Parameters

```typescript
const model = openrouter('anthropic/claude-3.7-sonnet:thinking', {
  extraBody: {
    reasoning: { max_tokens: 10 },
  },
});
```

---

## Key Migration Notes (v4 → v5+)

| Old (v4) | New (v5/v6) |
|---------|-------------|
| `parameters` | `inputSchema` |
| `part.args` | `part.input` |
| `part.result` | `part.output` |
| `tool-invocation` | `tool-{toolName}` typed parts |

**Evidence** ([vercel/ai](https://github.com/vercel/ai/blob/main/content/docs/08-migration-guides/26-migration-guide-5-0.mdx)):

> Replace the parameters property with inputSchema when defining tools using the tool function.

---

## Quick Reference

```typescript
// 1. Server API (/app/api/chat/route.ts)
import { streamText, tool, convertToModelMessages, isStepCount } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const tools = {
  getWeather: tool({
    description: 'Get weather',
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }) => ({ city, temp: 72 }),
  }),
};

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: openrouter('openai/gpt-4o'),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(5),
  });
  return result.toUIMessageStreamResponse();
}

// 2. Client Component
'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  const { messages, sendMessage, input, setInput } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  return (
    <div>
      {messages.map(m => m.parts.map((part, i) => (
        part.type === 'text' ? <p key={i}>{part.text}</p> :
        part.type === 'tool-getWeather' && part.state === 'output-available'
          ? <div key={i}>{part.output.temp}°</div> : null
      )))}
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={() => sendMessage(input)}>Send</button>
    </div>
  );
}
```