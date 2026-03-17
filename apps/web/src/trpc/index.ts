import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { type EmbedderRouter, embedderRouter } from "./embedder/index";
import { type ApiRouter, apiRouter } from "./procedures/index";
import { createTRPCContext } from "./trpc";

/**
 * Inference helpers for input types
 * @example
 * type PostByIdInput = RouterInputs['post']['byId']
 *      ^? { id: number }
 **/
type RouterInputs = inferRouterInputs<ApiRouter>;

/**
 * Inference helpers for output types
 * @example
 * type AllPostsOutput = RouterOutputs['post']['all']
 *      ^? Post[]
 **/
type RouterOutputs = inferRouterOutputs<ApiRouter>;

export * from "./types";
export type { ApiRouter, EmbedderRouter, RouterInputs, RouterOutputs };
export { apiRouter, createTRPCContext, embedderRouter };
