import type { TRPCRouterRecord } from "@trpc/server";

import { protectedProcedure, publicProcedure } from "../trpc";

export const authRouter = {
	getSecretMessage: protectedProcedure.query(() => {
		return "Hello World";
	}),
	getSession: publicProcedure.query(() => {
		return "Hello World";
	}),
} satisfies TRPCRouterRecord;
