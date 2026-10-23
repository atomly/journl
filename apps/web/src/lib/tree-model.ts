import type { Folder, Page } from "@acme/db/schema";

const ROOT_PARENT_KEY = "root";
export type TreeFolder = Folder & {
  edge_id: string;
  node_id: string;
  parent_node_id: string | null;
};

export type TreePage = Page & {
  edge_id: string;
  node_id: string;
  parent_node_id: string | null;
};

export type TreeItem =
  | {
      edge_id: string;
      folder: TreeFolder;
      kind: "folder";
      node_id: string;
      pending?: boolean;
      parent_node_id: string | null;
    }
  | {
      edge_id: string;
      kind: "page";
      node_id: string;
      pending?: boolean;
      page: TreePage;
      parent_node_id: string | null;
    };

export type TreeItemRef = {
  kind: "folder" | "page";
  nodeId: string;
};

export type TreeDragData = {
  edgeId: string;
  item: TreeItemRef;
  label: string;
  parentNodeId: string | null;
};

export type DropTarget =
  | {
      parentNodeId: string | null;
      type: "inside" | "parent" | "end";
    }
  | {
      anchorEdgeId: string;
      parentNodeId: string | null;
      type: "after" | "before";
    };

export function encodeParentKey(parentNodeId: string | null) {
  return parentNodeId ?? ROOT_PARENT_KEY;
}

export function decodeParentKey(parentKey: string) {
  return parentKey === ROOT_PARENT_KEY ? null : parentKey;
}

export function getDragId(item: TreeItemRef) {
  return `drag:${item.kind}:${item.nodeId}`;
}

export function getBeforeDropId({
  anchorEdgeId,
  parentNodeId,
}: {
  anchorEdgeId: string;
  parentNodeId: string | null;
}) {
  return `drop:before:${encodeParentKey(parentNodeId)}:${anchorEdgeId}`;
}

export function getAfterDropId({
  anchorEdgeId,
  parentNodeId,
}: {
  anchorEdgeId: string;
  parentNodeId: string | null;
}) {
  return `drop:after:${encodeParentKey(parentNodeId)}:${anchorEdgeId}`;
}

export function getInsideDropId(nodeId: string) {
  return `drop:inside:${nodeId}`;
}

export function getParentDropId(parentNodeId: string | null) {
  return `drop:parent:${encodeParentKey(parentNodeId)}`;
}

export function parseDropTarget(id: unknown): DropTarget | null {
  if (typeof id !== "string") {
    return null;
  }

  const parts = id.split(":");
  if (parts[0] !== "drop") {
    return null;
  }

  if (parts[1] === "inside") {
    const nodeId = parts[2];
    if (!nodeId) {
      return null;
    }

    return {
      parentNodeId: nodeId,
      type: "inside",
    };
  }

  if (parts[1] === "parent" || parts[1] === "end") {
    const parentKey = parts[2];
    if (!parentKey) {
      return null;
    }

    return {
      parentNodeId: decodeParentKey(parentKey),
      type: parts[1],
    };
  }

  const position = parts[1];
  const parentKey = parts[2];
  const anchorEdgeId = parts[3];

  if (!parentKey || !anchorEdgeId) {
    return null;
  }

  if (position !== "before" && position !== "after") {
    return null;
  }

  return {
    anchorEdgeId,
    parentNodeId: decodeParentKey(parentKey),
    type: position,
  };
}

// Loaded ancestors are enough to reject known cycles before a drop is highlighted.
// The server remains authoritative for destinations whose ancestry isn't loaded.
export function isValidTreeDestination(
  nodeId: string,
  parentId: string | null,
  items: Pick<TreeItem, "node_id" | "parent_node_id">[],
) {
  const parents = new Map(
    items.map((item) => [item.node_id, item.parent_node_id]),
  );
  let ancestorId = parentId;
  const visited = new Set<string>();
  while (ancestorId !== null && !visited.has(ancestorId)) {
    if (ancestorId === nodeId) return false;
    visited.add(ancestorId);
    ancestorId = parents.get(ancestorId) ?? null;
  }
  return ancestorId === null;
}

/** A shared folder label for destination pickers, including duplicate names. */
export function folderDestinationLabel(
  nodeId: string,
  folders: readonly {
    node_id: string | null;
    parent_node_id: string | null;
    name: string;
  }[],
) {
  const byId = new Map(folders.map((folder) => [folder.node_id, folder]));
  const names: string[] = [];
  const visited = new Set<string>();
  let current: string | null = nodeId;
  while (current && !visited.has(current)) {
    visited.add(current);
    const folder = byId.get(current);
    if (!folder) break;
    names.unshift(folder.name || "New folder");
    current = folder.parent_node_id;
  }
  return names.join(" / ");
}
