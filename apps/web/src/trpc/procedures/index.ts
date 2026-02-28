import { createTRPCRouter } from "../trpc";
import { authRouter } from "./auth";
import { documentRouter } from "./document";
import { inviteRouter } from "./invite";
import { journalRouter } from "./journal";
import { modelPricingRouter } from "./model-pricing";
import { notesRouter } from "./notes";
import { pagesRouter } from "./pages";
import { subscriptionRouter } from "./subscription";
import { usageRouter } from "./usage";

export const apiRouter = createTRPCRouter({
  auth: authRouter,
  document: documentRouter,
  invite: inviteRouter,
  journal: journalRouter,
  modelPricing: modelPricingRouter,
  notes: notesRouter,
  pages: pagesRouter,
  subscription: subscriptionRouter,
  usage: usageRouter,
});

export type ApiRouter = typeof apiRouter;
