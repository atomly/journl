# Journl Agent Architecture

This document explains how the Mastra-based AI agent works in Journl, specifically how server-side agent code connects with client-side tool execution to perform actions like navigation, page creation, and editor manipulation.

## Overview

Journl uses a **hybrid architecture** where:
- **Server**: Mastra agent processes messages and decides which tools to call
- **Client**: React components execute the actual tool implementations with access to DOM, React hooks, and browser APIs

This allows the AI to trigger real-time UI changes (navigation, editor updates, drawer interactions) without server round-trips.

## Architecture Diagram

```
User Input (Chat)
    ↓
[Client: useChat hook]
    ↓ HTTP POST
[Server: /api/ai/journl-agent]
    ↓
[Server: Mastra Agent processes]
    ↓
[Server: Decides to call tool, e.g., "navigatePage"]
    ↓ Streams back tool call
[Client: onToolCall callback]
    ↓
[Client: Looks up tool in Map]
    ↓
[Client: Executes navigate-page.client.ts]
    ↓
[Client: router.push(), closeDrawer(), etc.]
```

## Complete Flow

### 1. Chat Initialization

The chat is initialized at the app root level:

**Location**: `apps/web/src/app/_components/app-providers.tsx`

```typescript
<ThreadRuntime
  transport={{
    api: "/api/ai/journl-agent",
  }}
  messages={[]}
>
  {children}
</ThreadRuntime>
```

### 2. Runtime Setup

`ThreadRuntime` calls the `useJournlAgent` hook to set up the chat runtime:

**Location**: `apps/web/src/components/assistant-ui/thread-runtime.tsx`

```typescript
const agent = useJournlAgent({
  messages,
  transport,
});
```

### 3. Client Tool Registration

`useJournlAgent` creates a Map of client-side tool implementations:

**Location**: `apps/web/src/ai/agents/use-journl-agent.tsx`

```typescript
export function useJournlAgent({ transport, messages }) {
  // Initialize client tool hooks
  const createPage = useCreatePageTool();
  const navigateJournalEntry = useNavigateJournalEntryTool();
  const navigatePage = useNavigatePageTool();
  const manipulateEditor = useManipulateEditorTool();

  // Create a Map for tool lookup
  const tools = new Map([
    [createPage.name, createPage],
    [navigateJournalEntry.name, navigateJournalEntry],
    [navigatePage.name, navigatePage],
    [manipulateEditor.name, manipulateEditor],
  ]);

  const chat = useChat({
    messages,
    onToolCall: async ({ toolCall }) => {
      // When server streams back a tool call, execute it client-side
      const tool = tools.get(toolCall.toolName);
      if (tool) {
        await tool.execute(toolCall, chat);
      }
    },
    // ... other config
  });

  return chat;
}
```

### 4. Message Sent to Server

When the user types a message, `useChat` sends an HTTP POST request to the API route:

**Location**: `apps/web/src/app/api/ai/journl-agent/route.ts`

```typescript
async function handler(req: Request) {
  const session = await getSession();
  const { messages, ...rest } = await req.json();

  // Call Mastra agent with messages and context
  const result = await journlAgent.streamVNext(messages, {
    format: "aisdk",
    runtimeContext: setJournlRuntimeContext({
      ...rest.context,
      user: { email: session.user.email, name: session.user.name },
    }),
  });

  return result.toUIMessageStreamResponse();
}
```

### 5. Mastra Agent Processing

The Mastra agent processes the message and decides which tools to call:

**Location**: `apps/web/src/ai/agents/journl-agent.ts`

```typescript
export const journlAgent = new Agent({
  name: "Journl",
  description: "An AI companion for personal reflection...",
  instructions: ({ runtimeContext }) => {
    // Dynamic instructions based on context
    const context = getJournlRuntimeContext(runtimeContext);
    return `You are Journl, an AI companion...
    
    Current date: ${context.currentDate}
    User's name: ${context.user.name}
    // ... more context-aware instructions
    `;
  },
  model,
  tools: {
    createPage,           // Schema only
    manipulateEditor,     // Schema only
    navigateJournalEntry, // Schema only
    navigatePage,         // Schema only
    semanticJournalSearch,
    semanticPageSearch,
    temporalJournalSearch,
  },
});
```

### 6. Server-Side Tool Definition (Schema Only)

Tools registered with the agent are **schema-only** definitions:

**Location**: `apps/web/src/ai/tools/navigate-page.ts`

```typescript
import { createTool } from "@mastra/core/tools";

export const navigatePage = createTool({
  id: "navigate-page",
  description: "A client-side tool that navigates to a page",
  inputSchema: zNavigatePageInput,
  outputSchema: z.void(),
});
```

**Important**: This file does NOT contain implementation logic. It only tells:
- The LLM what the tool does
- What parameters it accepts
- What it returns

### 7. Tool Call Streamed to Client

When Mastra decides to call a tool, it streams the tool call back to the client in AI SDK format.

### 8. Client Intercepts Tool Call

The `onToolCall` callback in `useJournlAgent` fires when a tool call is received:

```typescript
onToolCall: async ({ toolCall }) => {
  const tool = tools.get(toolCall.toolName); // e.g., "navigatePage"
  if (tool) {
    await tool.execute(toolCall, chat);
  }
}
```

### 9. Client-Side Tool Execution

The actual implementation runs client-side with full React access:

**Location**: `apps/web/src/ai/tools/navigate-page.client.ts`

```typescript
export function useNavigatePageTool() {
  const router = useRouter();  // Next.js router
  const { closeDrawer } = useDrawer();  // UI state
  
  const tool = createClientTool({
    name: "navigatePage",
    inputSchema: zNavigatePageInput,
    execute: (toolCall, chat) => {
      // Actual implementation with browser APIs and React hooks
      const page = `/pages/${toolCall.input.id}`;
      router.push(page);  // Navigate
      
      // Report back to chat
      chat.addToolResult({
        output: `Navigating to the page: ${page}`,
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
      });
      
      closeDrawer();  // Update UI
    },
  });
  
  return tool;
}
```

## Key Concepts

### Dual Tool Definitions

Every tool that requires client-side execution has TWO files:

1. **`tool-name.ts`** - Server-side schema (for Mastra agent)
   - Imported in `journl-agent.ts`
   - Uses `createTool` from `@mastra/core/tools`
   - Contains no implementation logic

2. **`tool-name.client.ts`** - Client-side implementation
   - Imported in `use-journl-agent.tsx`
   - Uses `createClientTool` utility
   - Contains actual execution logic with React hooks

### Client Tool Pattern

Client tools are created using the `createClientTool` utility:

**Location**: `apps/web/src/ai/utils/create-client-tool.ts`

```typescript
export function createClientTool({
  name,
  inputSchema,
  execute,
}) {
  return {
    name,
    execute: (toolCall, chat) => {
      validateToolCall(toolCall, name, inputSchema);
      return execute(toolCall, chat);
    },
  };
}
```

This utility:
- Validates the tool call matches the expected schema
- Provides type safety
- Gives access to the `chat` helper for reporting results

### Context Awareness

The agent receives context about the current app state on every request:

**Location**: `apps/web/src/ai/agents/use-journl-agent.tsx`

```typescript
prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => {
  return {
    body: {
      context: {
        activeEditors: Array.from(getEditors().entries()).map(...),
        currentDate: new Date().toLocaleString(),
        highlightedText: selections.map((s) => s.text),
        view: getView(),
      },
      messageId,
      messages,
      trigger,
    },
  };
}
```

This context is used in the agent's instructions to make context-aware decisions.

## Examples of Client-Side Actions

### Navigation

```typescript
// navigate-page.client.ts
router.push(`/pages/${toolCall.input.id}`);
```

### Page Creation

```typescript
// create-page.client.ts
createPage(
  { title: toolCall.input.title },
  {
    onSuccess: (newPage) => {
      // Optimistically update React Query cache
      queryClient.setQueryData(...);
      
      // Emit event for other components
      eventEmitter.buffer(new PageCreatedEvent(...));
      
      // Navigate to new page
      router.push(`/pages/${newPage.id}`);
    },
  }
);
```

### Editor Manipulation

```typescript
// manipulate-editor.client.ts
const editor = getEditors().get(toolCall.input.targetEditor)?.editor;
const aiExtension = getAIExtension(editor);

const response = await aiExtension.callLLM({
  userPrompt: toolCall.input.editorPrompt,
  onBlockUpdate: (block) => {
    // Auto-scroll to updated block
    document.querySelector(`[data-id="${block}"]`)?.scrollIntoView();
  },
});
```

## Adding a New Tool

To add a new client-side tool:

### 1. Create the Schema File

**File**: `apps/web/src/ai/tools/my-tool.schema.ts`

```typescript
import { z } from "zod";

export const zMyToolInput = z.object({
  // Define your input parameters
  param1: z.string(),
  param2: z.number().optional(),
});
```

### 2. Create the Server Definition

**File**: `apps/web/src/ai/tools/my-tool.ts`

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zMyToolInput } from "./my-tool.schema";

export const myTool = createTool({
  id: "my-tool",
  description: "A clear description for the LLM",
  inputSchema: zMyToolInput,
  outputSchema: z.void(),
});
```

### 3. Create the Client Implementation

**File**: `apps/web/src/ai/tools/my-tool.client.ts`

```typescript
"use client";

import { useRouter } from "next/navigation";
import { createClientTool } from "../utils/create-client-tool";
import { zMyToolInput } from "./my-tool.schema";

export function useMyTool() {
  const router = useRouter();
  
  const tool = createClientTool({
    name: "myTool",
    inputSchema: zMyToolInput,
    execute: async (toolCall, chat) => {
      try {
        // Your implementation here
        // Access React hooks, browser APIs, etc.
        
        // Report success
        chat.addToolResult({
          output: "Success message",
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      } catch (error) {
        // Report failure
        chat.addToolResult({
          output: `Error: ${error}`,
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      }
    },
  });
  
  return tool;
}
```

### 4. Register in Mastra Agent

**File**: `apps/web/src/ai/agents/journl-agent.ts`

```typescript
import { myTool } from "../tools/my-tool";

export const journlAgent = new Agent({
  // ... other config
  tools: {
    // ... existing tools
    myTool,
  },
});
```

Update the instructions to tell the agent when to use your tool:

```typescript
instructions: ({ runtimeContext }) => {
  return `...
  
  ### \`myTool\`
  
  Description of when and how to use this tool.
  `;
},
```

### 5. Register in Client Hook

**File**: `apps/web/src/ai/agents/use-journl-agent.tsx`

```typescript
import { useMyTool } from "../tools/my-tool.client";

export function useJournlAgent({ transport, messages }) {
  // ... other tools
  const myTool = useMyTool();
  
  const tools = new Map([
    // ... existing tools
    [myTool.name, myTool],
  ]);
  
  // ... rest of implementation
}
```

## Best Practices

### 1. Keep Server Definitions Simple

Server-side tool files should only contain the schema. No implementation logic.

### 2. Use Descriptive Tool Names

Tool names should match across both files:
- `createTool({ id: "myTool" })` → server
- `createClientTool({ name: "myTool" })` → client

### 3. Report Results Back

Always call `chat.addToolResult()` to inform the agent about success or failure:

```typescript
chat.addToolResult({
  output: "What happened",
  tool: toolCall.toolName,
  toolCallId: toolCall.toolCallId,
});
```

### 4. Handle Errors Gracefully

Wrap client tool execution in try-catch and report errors:

```typescript
try {
  // ... implementation
  chat.addToolResult({ output: "Success", ... });
} catch (error) {
  chat.addToolResult({ output: `Error: ${error}`, ... });
}
```

### 5. Leverage React Ecosystem

Client tools have full access to:
- React hooks (`useState`, `useEffect`, etc.)
- Next.js router
- React Query
- Custom hooks and context
- Browser APIs (DOM, localStorage, etc.)

### 6. Provide Clear Instructions

In `journl-agent.ts`, provide clear instructions about:
- When to use the tool
- What parameters to provide
- What the tool does and doesn't do
- Any prerequisites or constraints

## Troubleshooting

### Tool Not Executing

1. Check that tool names match exactly in both files
2. Verify the tool is registered in the `tools` Map in `use-journl-agent.tsx`
3. Check browser console for `onToolCall` logs (in development mode)

### Tool Call Not Appearing

1. Verify the tool is registered in `journl-agent.ts`
2. Check that instructions clearly tell the agent when to use the tool
3. Ensure the tool description is clear and accurate

### Type Errors

1. Ensure the schema is shared between server and client files
2. Use the same Zod schema for both `createTool` and `createClientTool`
3. Validate tool call input with the schema

## Related Files

- `apps/web/src/ai/agents/journl-agent.ts` - Main agent definition
- `apps/web/src/ai/agents/use-journl-agent.tsx` - Client agent hook
- `apps/web/src/ai/utils/create-client-tool.ts` - Client tool utility
- `apps/web/src/app/api/ai/journl-agent/route.ts` - API route handler
- `apps/web/src/components/assistant-ui/thread-runtime.tsx` - Runtime provider
- `apps/web/src/app/_components/app-providers.tsx` - App-level setup
