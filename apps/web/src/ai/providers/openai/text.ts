import { openai } from "@ai-sdk/openai";

// ! TODO: Move this to a shared package called `@acme/ai`.
export const model = openai("gpt-4o-mini");
