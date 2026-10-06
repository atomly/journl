import { openai } from "openai-sdk-v3";
import { miniModel } from "./text";

// BlockNote 0.55 uses AI SDK 6 for both its transport and server tools.
// Mastra 1.74 supports embedding specification v3, but not v4 yet.
// Keep these integrations on their supported SDK versions; the rest of the app
// continues to use AI SDK 7 and OpenAI SDK 4.
export const blockNoteModel = openai(miniModel.modelId);
export const memoryEmbedder = openai.embedding("text-embedding-3-small");
