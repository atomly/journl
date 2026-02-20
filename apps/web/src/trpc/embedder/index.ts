import { createTRPCRouter } from "../trpc";
import { documentRouter } from "./document";
import { documentEmbeddingRouter } from "./document-embedding";

export const embedderRouter = createTRPCRouter({
  document: documentRouter,
  documentEmbedding: documentEmbeddingRouter,
});

export type EmbedderRouter = typeof embedderRouter;
