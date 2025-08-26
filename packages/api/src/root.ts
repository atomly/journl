import { authRouter } from "./router/auth.js";
import { blocksRouter } from "./router/blocks.js";
import { documentRouter } from "./router/document.js";
import { journalRouter } from "./router/journal.js";
import { notesRouter } from "./router/notes.js";
import { pagesRouter } from "./router/pages.js";
import { usageRouter } from "./router/usage.js";
import { createTRPCRouter } from "./trpc.js";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  blocks: blocksRouter,
  document: documentRouter,
  journal: journalRouter,
  notes: notesRouter,
  pages: pagesRouter,
  usage: usageRouter,
});

export type AppRouter = typeof appRouter;
