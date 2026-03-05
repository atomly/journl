import { Memory } from "@mastra/memory";
import { model as embedder } from "../../providers/openai/embedding";
import { journlStore } from "./store";
import { journlVector } from "./vector";

const JOURNL_MEMORY_LAST_MESSAGES = 30;
const JOURNL_SEMANTIC_SEARCH_RANGE = 2;
const JOURNL_SEMANTIC_SEARCH_SCOPE = "thread";
const JOURNL_SEMANTIC_TOP_K = 3;

export const journlMemory = new Memory({
  embedder,
  options: {
    lastMessages: JOURNL_MEMORY_LAST_MESSAGES,
    semanticRecall: {
      messageRange: JOURNL_SEMANTIC_SEARCH_RANGE,
      scope: JOURNL_SEMANTIC_SEARCH_SCOPE,
      topK: JOURNL_SEMANTIC_TOP_K,
    },
  },
  storage: journlStore,
  vector: journlVector,
});
