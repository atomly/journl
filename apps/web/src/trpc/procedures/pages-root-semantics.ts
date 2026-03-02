export type PageFolderFilter =
  | {
      kind: "unscoped";
    }
  | {
      kind: "root";
    }
  | {
      folderId: string;
      kind: "folder";
    };

/**
 * Canonical representation: a page without a parent folder lives at root.
 */
export function normalizePageFolderId(
  folderId: string | null | undefined,
): string | null {
  return folderId ?? null;
}

export function getPageFolderFilter(
  folderId: string | null | undefined,
): PageFolderFilter {
  if (folderId === undefined) {
    return { kind: "unscoped" };
  }

  if (folderId === null) {
    return { kind: "root" };
  }

  return {
    folderId,
    kind: "folder",
  };
}
