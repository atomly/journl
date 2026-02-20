import { createTRPCRouter } from "../trpc.js";
import { documentRouter } from "./document.js";
import { documentEmbeddingRouter } from "./document-embedding.js";

export const embedderRouter = createTRPCRouter({
  document: documentRouter,
  documentEmbedding: documentEmbeddingRouter,
});

export type EmbedderRouter = typeof embedderRouter;
