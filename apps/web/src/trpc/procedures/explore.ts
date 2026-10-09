import { and, eq } from "@acme/db";
import {
  ExploreCluster,
  ExploreClusterMember,
  ExploreClusterSnapshot,
  ExploreState,
} from "@acme/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import {
  getCluster,
  getClusterMap,
  listClusterMembers,
  listClusterSources,
  listClusters,
  listRecentNotes,
  listRelatedThreads,
  listSourceContexts,
  listThreadConnections,
} from "~/explore/service";
import { protectedProcedure } from "../trpc";

const page = z.object({
  cursor: z.string().max(2048).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export const exploreRouter = {
  getCluster: protectedProcedure
    .input(
      z.object({
        clusterId: z.uuid(),
        cursor: z.string().max(2048).optional(),
      }),
    )
    .query(({ ctx, input }) =>
      getCluster(ctx.db, ctx.session.user.id, input.clusterId, input.cursor),
    ),
  getClusterMap: protectedProcedure
    .input(z.object({ clusterId: z.uuid() }))
    .query(({ ctx, input }) =>
      getClusterMap(ctx.db, ctx.session.user.id, input.clusterId),
    ),
  listClusterMembers: protectedProcedure
    .input(
      page.extend({
        clusterId: z.uuid(),
        role: z.enum(["primary", "related"]).default("primary"),
      }),
    )
    .query(({ ctx, input }) =>
      listClusterMembers(ctx.db, ctx.session.user.id, input),
    ),
  listClusterSources: protectedProcedure
    .input(page.extend({ clusterId: z.uuid() }))
    .query(({ ctx, input }) =>
      listClusterSources(ctx.db, ctx.session.user.id, input),
    ),
  listClusters: protectedProcedure
    .input(
      page.extend({
        limit: z.number().int().min(1).max(24).default(12),
        search: z.string().max(100).optional(),
      }),
    )
    .query(({ ctx, input }) =>
      listClusters(ctx.db, ctx.session.user.id, input),
    ),
  listRecentNotes: protectedProcedure
    .input(
      page.extend({
        sort: z.enum(["latest", "oldest"]).default("latest"),
        unlinkedOnly: z.boolean().default(false),
      }),
    )
    .query(({ ctx, input }) =>
      listRecentNotes(ctx.db, ctx.session.user.id, input),
    ),
  listRelatedThreads: protectedProcedure
    .input(z.object({ clusterId: z.uuid() }))
    .query(({ ctx, input }) =>
      listRelatedThreads(ctx.db, ctx.session.user.id, input.clusterId),
    ),
  listSourceContexts: protectedProcedure
    .input(
      page.extend({ clusterId: z.uuid(), key: z.string().min(1).max(2100) }),
    )
    .query(({ ctx, input }) =>
      listSourceContexts(ctx.db, ctx.session.user.id, input),
    ),
  listThreadConnections: protectedProcedure
    .input(
      page.extend({ clusterId: z.uuid(), snapshotId: z.uuid().optional() }),
    )
    .query(({ ctx, input }) =>
      listThreadConnections(ctx.db, ctx.session.user.id, input),
    ),
  memberships: protectedProcedure
    .input(z.object({ documentId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          generatedName: ExploreClusterSnapshot.generated_name,
          id: ExploreCluster.id,
          name: ExploreCluster.manual_name,
          role: ExploreClusterMember.role,
        })
        .from(ExploreClusterMember)
        .innerJoin(
          ExploreState,
          and(
            eq(ExploreState.user_id, ctx.session.user.id),
            eq(
              ExploreState.active_snapshot_id,
              ExploreClusterMember.snapshot_id,
            ),
          ),
        )
        .innerJoin(
          ExploreCluster,
          and(
            eq(ExploreCluster.id, ExploreClusterMember.cluster_id),
            eq(ExploreCluster.user_id, ctx.session.user.id),
          ),
        )
        .innerJoin(
          ExploreClusterSnapshot,
          and(
            eq(ExploreClusterSnapshot.cluster_id, ExploreCluster.id),
            eq(
              ExploreClusterSnapshot.snapshot_id,
              ExploreState.active_snapshot_id,
            ),
            eq(ExploreClusterSnapshot.user_id, ctx.session.user.id),
          ),
        )
        .where(
          and(
            eq(ExploreClusterMember.user_id, ctx.session.user.id),
            eq(ExploreClusterMember.document_id, input.documentId),
          ),
        )
        .limit(4);
    }),
  renameCluster: protectedProcedure
    .input(
      z.object({
        clusterId: z.uuid(),
        name: z.string().trim().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(ExploreCluster)
        .set({ manual_name: input.name })
        .where(
          and(
            eq(ExploreCluster.id, input.clusterId),
            eq(ExploreCluster.user_id, ctx.session.user.id),
          ),
        )
        .returning({ id: ExploreCluster.id });
      if (!updated)
        throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
      return updated;
    }),
} satisfies TRPCRouterRecord;
