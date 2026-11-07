import { createTRPCRouter } from "../trpc";
import { authRouter } from "./auth";
import { chatRouter } from "./chat";
import { documentRouter } from "./document";
import { exploreRouter } from "./explore";
import { foldersRouter } from "./folders";
import { inviteRouter } from "./invite";
import { journalRouter } from "./journal";
import { modelPricingRouter } from "./model-pricing";
import { notesRouter } from "./notes";
import { pagesRouter } from "./pages";
import { referencesRouter } from "./references";
import { subscriptionRouter } from "./subscription";
import { treeRouter } from "./tree";
import { usageRouter } from "./usage";

export const apiRouter = createTRPCRouter({
  auth: authRouter,
  chat: chatRouter,
  document: documentRouter,
  explore: exploreRouter,
  folders: foldersRouter,
  invite: inviteRouter,
  journal: journalRouter,
  modelPricing: modelPricingRouter,
  notes: notesRouter,
  pages: pagesRouter,
  references: referencesRouter,
  subscription: subscriptionRouter,
  tree: treeRouter,
  usage: usageRouter,
});

export type ApiRouter = typeof apiRouter;
