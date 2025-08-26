import { openai } from "@ai-sdk/openai";

// ! TODO: Move this to a shared package called `@acme/ai`.
export const model = openai.embedding("text-embedding-3-small");
