import type { PaginatedTreeChildrenInput } from "~/trpc";

export function getInfiniteSidebarTreeQueryOptions(
  parentNodeId: string | null = null,
): PaginatedTreeChildrenInput {
  return {
    cursor: undefined,
    cursor_edge_id: undefined,
    /* 10 (journl) items per page */
    limit: 10,
    parent_node_id: parentNodeId,
  };
}

export const infiniteSidebarTreeQueryOptions =
  getInfiniteSidebarTreeQueryOptions(null);
