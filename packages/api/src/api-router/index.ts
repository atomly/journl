import { createTRPCRouter } from "../trpc.js";
import { authRouter } from "./auth.js";
import { documentRouter } from "./document.js";
import { journalRouter } from "./journal.js";
import { notesRouter } from "./notes.js";
import { pagesRouter } from "./pages.js";
import { usageRouter } from "./usage.js";

export const apiRouter = createTRPCRouter({
  auth: authRouter,
  document: documentRouter,
  journal: journalRouter,
  notes: notesRouter,
  pages: pagesRouter,
  usage: usageRouter,
});

export type ApiRouter = typeof apiRouter;
