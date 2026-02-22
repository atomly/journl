import { openai } from "@ai-sdk/openai";

// ! TODO: Move this to a shared package called `@acme/ai`.
export const miniModel = openai("gpt-5-mini");
export const nanoModel = openai("gpt-5-nano");
