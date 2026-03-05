import type { PaginatedPagesInput } from "~/trpc";

export function getInfinitePagesQueryOptions(
  _parentNodeId?: string | null,
): PaginatedPagesInput {
  return {
    direction: "forward",
    /* 10 (journl) pages per page */
    limit: 10,
  };
}

export function getUnscopedInfinitePagesQueryOptions(): PaginatedPagesInput {
  return {
    direction: "forward",
    /* 10 (journl) pages per page */
    limit: 10,
  };
}

export const infinitePagesQueryOptions = getInfinitePagesQueryOptions();
