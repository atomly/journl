import type { PaginatedSidebarTreeInput } from "~/trpc";

export function getInfiniteSidebarTreeQueryOptions(
  parentFolderId: string | null = null,
): PaginatedSidebarTreeInput {
  return {
    /* 10 (journl) items per page */
    limit: 10,
    parent_folder_id: parentFolderId,
  };
}

export const infiniteSidebarTreeQueryOptions =
  getInfiniteSidebarTreeQueryOptions(null);
