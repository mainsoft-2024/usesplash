# Research: Vercel AI SDK v6 Streaming with Tools Best Practices

**Date**: 2026-04-13

## Summary

This research covers the latest best practices for Vercel AI SDK v6 streaming with tools, based on official documentation and real GitHub issues/PRs from 2025-2026. Key findings include the complete `onFinish` callback signature with `usage` (added in Jan 2026), the distinction between `ModelMessage` and `UIMessage` types, and important patterns for persisting chat messages including tool calls.

---

## 1. onFinish Callback Signature

### Current (v6) Signature

The `onFinish` callback receives an event object with the following properties:

```typescript
onFinish: {
  text: string;                    // Generated text
  finishReason: string;            // 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other'
  usage: LanguageModelUsage;       // Token usage for THIS step (added Jan 2026)
  totalUsage: LanguageModelUsage;  // Aggregated token usage across ALL steps
  response: {
    messages: ModelMessage[];      // Messages generated during this step
    finishReason: string;
    headers?: Record<string, string>;
  };
  steps: StepResult<TOOLS>[];       // Results from all steps
  stepNumber: number;              // Zero-based index of the final step
  model: {
    modelId: string;
    provider: string;
    rawModelId?: string;
  };
  providerMetadata?: ProviderMetadata;
}
```

### Key Update: Usage in onFinish

The `usage` field was added to `useChat`'s `onFinish` callback in January 2026 ([PR #11804](https://github.com/vercel/ai/pull/11804)).

**Evidence** ([PR #11804](https://github.com/vercel/ai/pull/11804)):
> feat(ai): expose token usage in useChat onFinish callback
> Added the `usage` field to the `onFinish` callback of `useChat`. Propagated totalUsage from the finish chunk in streamText to the UI message stream.

### On Abort Handling

For proper `onFinish` callback execution on stream abort, use `consumeStream`:

```typescript
import { consumeStream, streamText } from 'ai';

export async function POST(req: Request) {
  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ isAborted }) => {
      // Now this IS called even when aborted!
      if (isAborted) {
        console.log('Stream was aborted');
      } else {
        console.log('Stream completed normally');
      }
    },
    consumeSseStream: consumeStream, // This enables onFinish to be called on abort
  });
}
```

---

## 2. response.messages: ModelMessage vs UIMessage

### Type Definitions

**UIMessage** (used in `useChat`):
```typescript
// Roles: 'system' | 'user' | 'assistant' | 'tool'
UIMessage<InferUIMessageData, InferUIMessageTools>
```

**ModelMessage** (used in `streamText`/`generateText`):
```typescript
// Roles: 'system' | 'user' | 'assistant' | 'tool'
ModelMessage = 
  | SystemModelMessage
  | UserModelMessage  
  | AssistantModelMessage
  | ToolModelMessage
```

### Key Insight: Tool Role

The `role: 'tool'` message is part of `ModelMessage` but NOT `UIMessage`. This is critical for persistence.

**Evidence** ([Issue #12147](https://github.com/vercel/ai/issues/12147)):
> The issue occurs because `convertToModelMessages` encounters `role: 'tool'` which is not part of `UIMessage` type and throws an error.

---

## 3. Persisting Chat Messages with Tool Calls

### Best Practice Pattern

```typescript
// Server side - in your API route
export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
    tools: myTools,
    stopWhen: stepCountIs(5),
    onFinish: async ({ response, steps }) => {
      // response.messages includes ALL messages including tool results
      // steps contains detailed step results with tool calls/errors
      
      await db.saveMessages(response.messages);
      
      // For detailed tool information:
      for (const step of steps) {
        for (const toolCall of step.toolCalls || []) {
          console.log(`Tool: ${toolCall.toolName}`, toolCall.args);
        }
        if (step.toolResults) {
          for (const result of step.toolResults) {
            console.log(`Result for ${result.toolName}:`, result.result);
          }
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### Important Notes

1. **`convertToModelMessages` is async** in v6 (added in late 2025):
   ```typescript
   // v5
   const modelMessages = convertToModelMessages(uiMessages);
   
   // v6
   const modelMessages = await convertToModelMessages(uiMessages);
   ```

2. **When loading persisted messages** - if your DB stored `ModelMessage` format (with `role: 'tool'`), you must NOT pass them back through `convertToModelMessages`. Instead, pass them directly to `streamText`:

   ```typescript
   // Correct: Pass persisted ModelMessages directly
   const result = streamText({
     model: openai('gpt-4o'),
     messages: persistedModelMessages, // Already ModelMessage[]
   });
   
   // Incorrect: This will fail because convertToModelMessages 
   // doesn't accept 'tool' role from UIMessage
   const result = streamText({
     model: openai('gpt-4o'),
     messages: await convertToModelMessages(persistedMessages), // ERROR
   });
   ```

3. **Ignore incomplete tool calls** - when loading messages with pending approvals:
   ```typescript
   const modelMessages = await convertToModelMessages(messages, {
     ignoreIncompleteToolCalls: true, // Skips tool calls in 'approval-requested' state
   });
   ```

---

## 4. toolCallStreaming for Tool Progress

### How It Works

The `toolCallStreaming` option streams tool call arguments as they are being generated, not the results.

```typescript
const result = streamText({
  model: openai('gpt-4o'),
  messages,
  toolCallStreaming: true, // Enable streaming of tool call arguments
  tools: {
    getWeather: tool({
      description: 'Get weather for a location',
      inputSchema: z.object({
        location: z.string(),
      }),
      execute: async ({ location }) => {
        return { temperature: 72, conditions: 'sunny' };
      },
      // Optional: callbacks for observing tool args streaming
      onArgsStreamingStart: (options) => {
        console.log('Tool args streaming started:', options.toolCallId);
      },
      onArgsStreamingDelta: (options, delta) => {
        console.log('Partial args:', options.args);
      },
      onArgsAvailable: (options) => {
        console.log('Full args available:', options.args);
      },
    }),
  },
});
```

### Important Limitation

**Evidence** ([Issue #6822](https://github.com/vercel/ai/issues/6822)):
> The tool-call-streaming configuration only streams the input arguments of tool calls, but tool results are not streamed and only appear once the execution is fully completed.

Tool result streaming is NOT currently supported - only the input arguments are streamed.

### Provider Compatibility

Not all providers support `toolCallStreaming`. It works well with OpenAI but may not work with Google/Gemini models.

**Evidence** ([Issue #5544](https://github.com/vercel/ai/issues/5544)):
> While `toolCallStreaming` works correctly with `openai("gpt-4o")`, when I switch to `google("gemini-2.0-flash-001")` or `bedrock(...)`, `toolInvocation.args` does not stream.

---

## 5. "Tool result is missing" Errors

### Common Causes and Fixes

#### Cause 1: Pending Tool Calls Without Results

**Error**: `AI_MissingToolResultsError: Tool results are missing for tool calls: ...`

**Evidence** ([Troubleshooting Guide](https://sdk.vercel.ai/docs/troubleshooting/missing-tool-results-error)):
> This error occurs when you attempt to send a new message to the LLM while there are pending tool calls from a previous turn that have not yet been resolved.

**Fix**:
```typescript
// Option 1: Filter out incomplete tool calls when loading
const modelMessages = await convertToModelMessages(messages, {
  ignoreIncompleteToolCalls: true,
});

// Option 2: Manually filter before conversion
const sanitizedMessages = messages.map(msg => ({
  ...msg,
  parts: msg.parts.filter(part => 
    part.type !== 'tool-invocation' || part.toolInvocation.state === 'result'
  ),
}));
```

#### Cause 2: Tool in 'approval-requested' State

**Evidence** ([Issue #12709](https://github.com/vercel/ai/issues/12709)):
> When a user sends a new message while a tool is in `approval-requested` state, `convertToModelMessages` produces a `tool-call` without a matching `tool-result`, causing the provider error.

**Fix** - Use `ignoreIncompleteToolCalls: true`:
```typescript
const modelMessages = await convertToModelMessages(messages, {
  ignoreIncompleteToolCalls: true,
});
```

#### Cause 3: Provider-Executed Tools Missing Results

**Evidence** ([Issue #13533](https://github.com/vercel/ai/issues/13533)):
> When the provider omits a `tool-result` for a provider-executed tool (like `web_search`), the AI SDK should not include the orphaned `tool-call` in the response.

**Fix** - Use middleware to filter orphaned provider tool calls:
```typescript
const result = streamText({
  model: googleVertex('anthropic-claude-3-5-sonnet'),
  messages,
  tools: myTools,
  middleware: {
    wrapStream: ({ stream }) => {
      // Buffer provider tool calls, only flush when matching result arrives
      // Drop orphaned tool calls on stream end
    },
  },
});
```

#### Cause 4: tool().parameters vs inputSchema Bug

**Evidence** ([Issue #13460](https://github.com/vercel/ai/issues/13460)):
> `tool()` sets the schema on `.parameters`, but `prepareToolsAndToolChoice` reads `.inputSchema` — which is `undefined`. This causes all tool schemas to fall through to the empty default.

**Fix** - Use `inputSchema` instead of `parameters`:
```typescript
// Broken in some versions (parameters not read)
tool({
  parameters: z.object({ q: z.string() }), // ❌
});

// Use inputSchema instead
tool({
  inputSchema: z.object({ q: z.string() }), // ✅
});
```

---

## 6. Long-Running Tool Executions

### Recommended Pattern

Use `experimental_onToolCallStart` and `experimental_onToolCallFinish` callbacks:

```typescript
import { generateText, tool } from 'ai';

const result = await generateText({
  model: openai('gpt-4o'),
  tools: {
    longRunningTask: tool({
      description: 'A task that takes a long time',
      inputSchema: z.object({
        taskId: z.string(),
      }),
      execute: async ({ taskId }, options) => {
        // Check for abort signal periodically
        if (options.abortSignal?.aborted) {
          throw new Error('Task cancelled');
        }
        
        // Process in chunks with progress
        const results = [];
        for (const chunk of await fetchChunks(taskId)) {
          results.push(chunk);
          // Report progress via another mechanism if needed
        }
        return results;
      },
    }),
  },
  experimental_onToolCallStart: (event) => {
    console.log(`Starting tool: ${event.toolCall.toolName}`);
  },
  experimental_onToolCallFinish: (event) => {
    if (event.success) {
      console.log(`Tool ${event.toolCall.toolName} completed in ${event.durationMs}ms`);
    } else {
      console.log(`Tool ${event.toolCall.toolName} failed:`, event.error);
    }
  },
});
```

### Timeout Configuration

```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  tools: longRunningTools,
  timeout: {
    totalMs: 120000,    // Total timeout
    stepMs: 60000,      // Per-step timeout
    chunkMs: 30000,    // Per-chunk timeout
  },
  abortSignal: req.signal,
});
```

---

## 7. stopWhen: stepCountIs(N) and Tool Execution Timing

### How It Works

**Evidence** ([AI SDK Core docs](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)):
> The `stopWhen` conditions are only evaluated when the last step contains tool results.

```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  tools: myTools,
  stopWhen: stepCountIs(5), // Stops after 5 steps with tool results
});
```

### Important Behavior

1. **Step counting**: A step is one LLM call. If the model generates text, the step completes. If the model calls a tool, the tool executes and triggers another step.

2. **Default behavior** - If you don't set `stopWhen`, the default is `stepCountIs(1)` which stops after the first step (right after tool results):

   **Evidence** ([Issue #12367](https://github.com/vercel/ai/issues/12367)):
   > one thing to note: `maxSteps` was removed in SDK 6 and replaced with `stopWhen`. if you're still using `maxSteps`, it will be silently ignored and the default `stopWhen = stepCountIs(1)` kicks in.

3. **Combining conditions**:
   ```typescript
   stopWhen: [
     stepCountIs(10),           // Maximum 10 steps
     hasToolCall('finalAnswer'), // OR when finalAnswer is called
   ]
   ```

4. **Interaction with sendAutomaticallyWhen**: These are independent - `stopWhen` controls server-side loop, `sendAutomaticallyWhen` controls client-side automatic submission.

---

## 8. Tool Error Handling: Thrown Error vs Error Object

### The Difference

**Evidence** ([AI SDK Tool Calling docs](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)):
> When tool execution fails (errors thrown by your tool's `execute` function), the AI SDK adds them as `tool-error` content parts to enable automated LLM roundtrips in multi-step scenarios.

#### Option 1: Throw an Error (causes LLM to retry)

```typescript
const tool = tool({
  execute: async ({ input }) => {
    try {
      return await riskyOperation(input);
    } catch (error) {
      // Throwing causes tool-error to be sent to LLM
      // LLM can decide to retry or handle differently
      throw new Error(`Operation failed: ${error.message}`);
    }
  },
});
```

#### Option 2: Return an Error Object (LLM sees it as a result)

```typescript
const tool = tool({
  execute: async ({ input }) => {
    try {
      return await riskyOperation(input);
    } catch (error) {
      // Returning error object - LLM sees this as a normal result
      // Can continue conversation without retry
      return { 
        error: true, 
        message: error.message,
        code: 'OPERATION_FAILED'
      };
    }
  },
});
```

### Error Handling in Stream

```typescript
const result = streamText({
  model: openai('gpt-4o'),
  tools: myTools,
});

return result.toUIMessageStreamResponse({
  onError: (error) => {
    // Custom error messages for different error types
    if (NoSuchToolError.isInstance(error)) {
      return 'The model tried to call an unknown tool.';
    } else if (InvalidToolInputError.isInstance(error)) {
      return 'The model called a tool with invalid inputs.';
    } else if (ToolExecutionError.isInstance(error)) {
      return 'A tool execution error occurred.';
    }
    return 'An unknown error occurred.';
  },
});
```

### Accessing Errors in Results

```typescript
const { steps } = await generateText({
  model: openai('gpt-4o'),
  tools: myTools,
});

for (const step of steps) {
  if (step.toolResults) {
    for (const result of step.toolResults) {
      if (result.error) {
        console.log(`Tool ${result.toolName} error:`, result.error);
      }
    }
  }
}
```

---

## Additional Resources

- **Official Docs**: https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling
- **Migration Guide v5 to v6**: https://sdk.vercel.ai/docs/migration-guides/migration-guide-6-0
- **Error Reference**: https://sdk.vercel.ai/docs/reference/ai-sdk-errors
- **AI SDK v6 Announcement**: https://vercel.com/blog/ai-sdk-6