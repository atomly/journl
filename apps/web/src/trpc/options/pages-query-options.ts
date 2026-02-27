import type { PaginatedPagesInput } from "~/trpc";

export function getInfinitePagesQueryOptions(
  folderId: string | null,
): PaginatedPagesInput {
  return {
    direction: "forward",
    folder_id: folderId,
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

export const infinitePagesQueryOptions = getInfinitePagesQueryOptions(null);
