import { openai } from "openai-sdk-v3";

// Mastra memory still requires embedding specification v3.
export const memoryEmbedder = openai.embedding("text-embedding-3-small");
