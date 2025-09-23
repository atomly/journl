"use client";

import { createOpenAI } from "@ai-sdk/openai";
import { createBlockNoteAIClient } from "@blocknote/xl-ai";

const client = createBlockNoteAIClient({
  apiKey: "", // This is proxied through the server, and not exposed to the client.
  baseURL: "/api/ai/blocknote",
});

// ! TODO: Move this to a shared package called `@acme/ai`.
export const model = createOpenAI({
  ...client.getProviderSettings("openai"),
  baseURL: "/api/ai/blocknote",
  fetch: (input, init) => {
    return fetch(input, {
      ...init,
      credentials: "include",
    });
  },
})("gpt-5-mini");
