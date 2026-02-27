import type { PaginatedNestedFolderPagesInput } from "~/trpc";

export function getInfiniteNestedFolderPagesQueryOptions(
  folderId: string,
): PaginatedNestedFolderPagesInput {
  return {
    folder_id: folderId,
    /* 20 nested pages per page */
    limit: 20,
  };
}
