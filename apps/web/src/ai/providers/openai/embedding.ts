import { openai } from "@ai-sdk/openai";

export const model = openai.embedding("text-embedding-3-small");
