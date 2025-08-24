import { aiRouter } from "./router/ai.js";
import { authRouter } from "./router/auth.js";
import { blocksRouter } from "./router/blocks.js";
import { documentRouter } from "./router/document.js";
import { journalRouter } from "./router/journal.js";
import { notesRouter } from "./router/notes.js";
import { pagesRouter } from "./router/pages.js";
import { createTRPCRouter } from "./trpc.js";

export const appRouter = createTRPCRouter({
  ai: aiRouter,
  auth: authRouter,
  blocks: blocksRouter,
  document: documentRouter,
  journal: journalRouter,
  notes: notesRouter,
  pages: pagesRouter,
});

export type AppRouter = typeof appRouter;
