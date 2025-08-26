import type { TRPCRouterRecord } from "@trpc/server";

import { protectedProcedure, publicProcedure } from "../trpc.js";

export const authRouter = {
  getSecretMessage: protectedProcedure.query(() => {
    return "Hello World";
  }),
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),
} satisfies TRPCRouterRecord;
