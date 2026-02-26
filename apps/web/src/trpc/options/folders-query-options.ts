import type { PaginatedFoldersInput } from "~/trpc";

export function getInfiniteFoldersQueryOptions(
  parentFolderId: string | null,
): PaginatedFoldersInput {
  return {
    limit: 10,
    parent_folder_id: parentFolderId,
  };
}

export const infiniteFoldersQueryOptions = getInfiniteFoldersQueryOptions(null);
