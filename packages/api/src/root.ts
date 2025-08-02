import { authRouter } from "./router/auth.js";
import { blocksRouter } from "./router/blocks.js";
import { journalRouter } from "./router/journal.js";
import { notesRouter } from "./router/notes.js";
import { pagesRouter } from "./router/pages.js";
import { createTRPCRouter } from "./trpc.js";

export const appRouter = createTRPCRouter({
	auth: authRouter,
	blocks: blocksRouter,
	journal: journalRouter,
	notes: notesRouter,
	pages: pagesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
