export type SidebarTreeItemKind = "folder" | "page";

export type SidebarTreePosition = {
  id: string;
  kind: SidebarTreeItemKind;
  updatedAt: string;
};

const CURSOR_SEPARATOR = "|";

const KIND_ORDER: Record<SidebarTreeItemKind, number> = {
  folder: 0,
  page: 1,
};

export function encodeSidebarTreeCursor({
  id,
  kind,
  updatedAt,
}: SidebarTreePosition): string {
  return `${updatedAt}${CURSOR_SEPARATOR}${kind}${CURSOR_SEPARATOR}${id}`;
}

export function decodeSidebarTreeCursor(
  cursor?: string,
): SidebarTreePosition | null {
  if (!cursor) {
    return null;
  }

  const [updatedAt, kind, id] = cursor.split(CURSOR_SEPARATOR);
  if (!updatedAt || !kind || !id) {
    return null;
  }

  if (kind !== "folder" && kind !== "page") {
    return null;
  }

  return {
    id,
    kind,
    updatedAt,
  };
}

/**
 * Sort order for the mixed sidebar stream:
 * updated_at desc, kind (folder first), id desc.
 */
export function compareSidebarTreePositions(
  left: SidebarTreePosition,
  right: SidebarTreePosition,
): number {
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt > right.updatedAt ? -1 : 1;
  }

  const leftKindOrder = KIND_ORDER[left.kind];
  const rightKindOrder = KIND_ORDER[right.kind];
  if (leftKindOrder !== rightKindOrder) {
    return leftKindOrder - rightKindOrder;
  }

  if (left.id === right.id) {
    return 0;
  }

  return left.id > right.id ? -1 : 1;
}

export function isSidebarTreePositionAfterCursor(
  item: SidebarTreePosition,
  cursor: SidebarTreePosition,
): boolean {
  return compareSidebarTreePositions(item, cursor) > 0;
}

export function sortSidebarTreePositions<T extends SidebarTreePosition>(
  items: T[],
): T[] {
  return [...items].sort(compareSidebarTreePositions);
}
