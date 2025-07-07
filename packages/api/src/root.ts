import { authRouter } from "./router/auth.js";
import { journalRouter } from "./router/journal.js";
import { pagesRouter } from "./router/pages.js";
import { createTRPCRouter } from "./trpc.js";

export const appRouter = createTRPCRouter({
	auth: authRouter,
	journal: journalRouter,
	pages: pagesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
