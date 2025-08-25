import { createTRPCRouter } from "../trpc.js";
import { documentRouter } from "./document.js";
import { documentEmbeddingRouter } from "./document-embedding.js";
import { documentEmbeddingTaskRouter } from "./document-embedding-task.js";

export const embedderRouter = createTRPCRouter({
  document: documentRouter,
  documentEmbedding: documentEmbeddingRouter,
  documentEmbeddingTask: documentEmbeddingTaskRouter,
});

export type EmbedderRouter = typeof embedderRouter;
