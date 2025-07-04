import type { TRPCRouterRecord } from "@trpc/server";

import { protectedProcedure, publicProcedure } from "../trpc";

export const postRouter = {
	all: publicProcedure.query(() => {
		return "Hello World";
	}),

	byId: publicProcedure.query(() => {
		return "Hello World";
	}),

	create: protectedProcedure.mutation(() => {
		return "Hello World";
	}),

	delete: protectedProcedure.mutation(() => {
		return "Hello World";
	}),
} satisfies TRPCRouterRecord;
