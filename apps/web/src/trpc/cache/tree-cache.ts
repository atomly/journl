import type {
  InfiniteData,
  QueryClient,
  QueryFilters,
  QueryKey,
} from "@tanstack/react-query";
import type { RouterOutputs } from "~/trpc";

export type TreeChildrenPage = RouterOutputs["tree"]["getChildrenPaginated"];
export type TreeItem = TreeChildrenPage["items"][number];
export type TreeChildrenInfiniteData = InfiniteData<TreeChildrenPage, unknown>;

export type NestedPagesPage = RouterOutputs["tree"]["getNestedPagesPaginated"];
export type NestedPageItem = NestedPagesPage["items"][number];
export type NestedPagesInfiniteData = InfiniteData<NestedPagesPage, unknown>;

export type TreeDestination = {
  anchor_edge_id?: string;
  parent_node_id: string | null;
  position?: "after" | "before";
};

export type QuerySnapshot = {
  data: unknown;
  queryKey: QueryKey;
};

export function getEmptyTreeChildrenData(): TreeChildrenInfiniteData {
  return {
    pageParams: [],
    pages: [
      {
        items: [],
        nextCursor: undefined,
      },
    ],
  };
}

export function ensureTreeContainer({
  queryClient,
  queryKey,
}: {
  queryClient: QueryClient;
  queryKey: QueryKey;
}) {
  const existing = queryClient.getQueryData<TreeChildrenInfiniteData>(queryKey);
  if (existing) {
    return existing;
  }

  const emptyData = getEmptyTreeChildrenData();
  queryClient.setQueryData(queryKey, emptyData);
  return emptyData;
}

export function seedEmptyContainer({
  queryClient,
  queryKey,
}: {
  queryClient: QueryClient;
  queryKey: QueryKey;
}) {
  queryClient.setQueryData<TreeChildrenInfiniteData>(
    queryKey,
    (old) => old ?? getEmptyTreeChildrenData(),
  );
}

function setTreeItemParentNodeId(item: TreeItem, parentNodeId: string | null) {
  if (item.kind === "folder") {
    return {
      ...item,
      folder: {
        ...item.folder,
        parent_node_id: parentNodeId,
      },
      parent_node_id: parentNodeId,
    };
  }

  return {
    ...item,
    page: {
      ...item.page,
      parent_node_id: parentNodeId,
    },
    parent_node_id: parentNodeId,
  };
}

export function findNodeInData({
  data,
  nodeId,
}: {
  data: TreeChildrenInfiniteData | undefined;
  nodeId: string;
}) {
  if (!data) {
    return null;
  }

  for (const page of data.pages) {
    const item = page.items.find((candidate) => candidate.node_id === nodeId);
    if (item) {
      return item;
    }
  }

  return null;
}

function insertItemInData({
  data,
  item,
  anchorEdgeId,
  position,
}: {
  data: TreeChildrenInfiniteData | undefined;
  item: TreeItem;
  anchorEdgeId?: string;
  position?: "after" | "before";
}) {
  const baseData = data ?? getEmptyTreeChildrenData();

  if (!anchorEdgeId || !position) {
    const [firstPage, ...restPages] = baseData.pages;

    if (!firstPage) {
      return {
        ...baseData,
        pages: [
          {
            items: [item],
            nextCursor: undefined,
          },
        ],
      };
    }

    return {
      ...baseData,
      pages: [
        {
          ...firstPage,
          items: [item, ...firstPage.items],
        },
        ...restPages,
      ],
    };
  }

  let inserted = false;
  const pages = baseData.pages.map((page) => {
    if (inserted) {
      return page;
    }

    const anchorIndex = page.items.findIndex(
      (candidate) => candidate.edge_id === anchorEdgeId,
    );

    if (anchorIndex < 0) {
      return page;
    }

    const insertAt = position === "before" ? anchorIndex : anchorIndex + 1;
    const nextItems = [...page.items];
    nextItems.splice(insertAt, 0, item);
    inserted = true;

    return {
      ...page,
      items: nextItems,
    };
  });

  if (inserted) {
    return {
      ...baseData,
      pages,
    };
  }

  return insertItemInData({
    data: baseData,
    item,
  });
}

function removeNodeFromData({
  data,
  nodeId,
}: {
  data: TreeChildrenInfiniteData | undefined;
  nodeId: string;
}) {
  if (!data) {
    return data;
  }

  let changed = false;

  const pages = data.pages.map((page) => {
    const nextItems = page.items.filter((item) => item.node_id !== nodeId);
    if (nextItems.length !== page.items.length) {
      changed = true;
    }

    return {
      ...page,
      items: nextItems,
    };
  });

  if (!changed) {
    return data;
  }

  return {
    ...data,
    pages,
  };
}

function updateNodeInData({
  data,
  nodeId,
  updater,
}: {
  data: TreeChildrenInfiniteData | undefined;
  nodeId: string;
  updater: (item: TreeItem) => TreeItem;
}) {
  if (!data) {
    return data;
  }

  let changed = false;
  const pages = data.pages.map((page) => {
    const items = page.items.map((item) => {
      if (item.node_id !== nodeId) {
        return item;
      }

      changed = true;
      return updater(item);
    });

    return {
      ...page,
      items,
    };
  });

  if (!changed) {
    return data;
  }

  return {
    ...data,
    pages,
  };
}

export function insertItem({
  anchorEdgeId,
  item,
  position,
  queryClient,
  queryKey,
}: {
  anchorEdgeId?: string;
  item: TreeItem;
  position?: "after" | "before";
  queryClient: QueryClient;
  queryKey: QueryKey;
}) {
  queryClient.setQueryData<TreeChildrenInfiniteData>(queryKey, (old) =>
    insertItemInData({
      anchorEdgeId,
      data: old,
      item,
      position,
    }),
  );
}

export function prependItems({
  items,
  queryClient,
  queryKey,
}: {
  items: TreeItem[];
  queryClient: QueryClient;
  queryKey: QueryKey;
}) {
  queryClient.setQueryData<TreeChildrenInfiniteData>(queryKey, (old) => {
    let nextData = old;

    for (const item of [...items].reverse()) {
      nextData = insertItemInData({
        data: nextData,
        item,
      });
    }

    return nextData;
  });
}

export function removeNode({
  nodeId,
  queryClient,
  queryFilter,
}: {
  nodeId: string;
  queryClient: QueryClient;
  queryFilter: QueryFilters;
}) {
  queryClient.setQueriesData<TreeChildrenInfiniteData>(queryFilter, (old) =>
    removeNodeFromData({
      data: old,
      nodeId,
    }),
  );
}

export function updateNode({
  nodeId,
  queryClient,
  queryFilter,
  updater,
}: {
  nodeId: string;
  queryClient: QueryClient;
  queryFilter: QueryFilters;
  updater: (item: TreeItem) => TreeItem;
}) {
  queryClient.setQueriesData<TreeChildrenInfiniteData>(queryFilter, (old) =>
    updateNodeInData({
      data: old,
      nodeId,
      updater,
    }),
  );
}

export function findNodeInQueries({
  nodeId,
  queryClient,
  queryFilter,
}: {
  nodeId: string;
  queryClient: QueryClient;
  queryFilter: QueryFilters;
}) {
  const queries =
    queryClient.getQueriesData<TreeChildrenInfiniteData>(queryFilter);

  for (const [, data] of queries) {
    const item = findNodeInData({
      data,
      nodeId,
    });

    if (item) {
      return item;
    }
  }

  return null;
}

export function moveNode({
  destination,
  getContainerQueryKey,
  nodeId,
  queryClient,
  queryFilter,
}: {
  destination: TreeDestination;
  getContainerQueryKey: (parentNodeId: string | null) => QueryKey;
  nodeId: string;
  queryClient: QueryClient;
  queryFilter: QueryFilters;
}) {
  const item = findNodeInQueries({
    nodeId,
    queryClient,
    queryFilter,
  });

  if (!item) {
    return null;
  }

  removeNode({
    nodeId,
    queryClient,
    queryFilter,
  });

  insertItem({
    anchorEdgeId: destination.anchor_edge_id,
    item: setTreeItemParentNodeId(item, destination.parent_node_id),
    position: destination.position,
    queryClient,
    queryKey: getContainerQueryKey(destination.parent_node_id),
  });

  return item;
}

export function setNodeParent({
  item,
  parentNodeId,
}: {
  item: TreeItem;
  parentNodeId: string | null;
}) {
  return setTreeItemParentNodeId(item, parentNodeId);
}

export function getLoadedTreeItems({
  queryClient,
  queryFilter,
}: {
  queryClient: QueryClient;
  queryFilter: QueryFilters;
}) {
  const queryData =
    queryClient.getQueriesData<TreeChildrenInfiniteData>(queryFilter);
  const deduped = new Map<string, TreeItem>();

  for (const [, data] of queryData) {
    if (!data) {
      continue;
    }

    for (const page of data.pages) {
      for (const item of page.items) {
        deduped.set(item.node_id, item);
      }
    }
  }

  return [...deduped.values()];
}

export function collectDescendantNodeIds({
  items,
  rootNodeId,
}: {
  items: TreeItem[];
  rootNodeId: string;
}) {
  const childNodeIdsByParent = new Map<string, string[]>();

  for (const item of items) {
    if (!item.parent_node_id) {
      continue;
    }

    const children = childNodeIdsByParent.get(item.parent_node_id) ?? [];
    children.push(item.node_id);
    childNodeIdsByParent.set(item.parent_node_id, children);
  }

  const descendants = new Set<string>([rootNodeId]);
  const queue = [...(childNodeIdsByParent.get(rootNodeId) ?? [])];

  while (queue.length > 0) {
    const nextNodeId = queue.shift();
    if (!nextNodeId || descendants.has(nextNodeId)) {
      continue;
    }

    descendants.add(nextNodeId);
    queue.push(...(childNodeIdsByParent.get(nextNodeId) ?? []));
  }

  return descendants;
}

export function removePageFromNestedPages({
  pageId,
  queryClient,
  queryFilter,
}: {
  pageId: string;
  queryClient: QueryClient;
  queryFilter: QueryFilters;
}) {
  queryClient.setQueriesData<NestedPagesInfiniteData>(queryFilter, (old) => {
    if (!old) {
      return old;
    }

    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.filter((item) => item.id !== pageId),
      })),
    };
  });
}

export function updatePageTitleInNestedPages({
  pageId,
  queryClient,
  queryFilter,
  title,
}: {
  pageId: string;
  queryClient: QueryClient;
  queryFilter: QueryFilters;
  title: string;
}) {
  queryClient.setQueriesData<NestedPagesInfiniteData>(queryFilter, (old) => {
    if (!old) {
      return old;
    }

    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.map((item) =>
          item.id === pageId
            ? ({
                ...item,
                title,
              } satisfies NestedPageItem)
            : item,
        ),
      })),
    };
  });
}

export function snapshotQueries({
  queryClient,
  queryFilter,
}: {
  queryClient: QueryClient;
  queryFilter: QueryFilters;
}): QuerySnapshot[] {
  return queryClient
    .getQueriesData(queryFilter)
    .map(([queryKey, data]) => ({ data, queryKey }));
}

export function restoreQueries({
  queryClient,
  snapshots,
}: {
  queryClient: QueryClient;
  snapshots: QuerySnapshot[];
}) {
  for (const snapshot of snapshots) {
    queryClient.setQueryData(snapshot.queryKey, snapshot.data);
  }
}

export function snapshotQuery({
  queryClient,
  queryKey,
}: {
  queryClient: QueryClient;
  queryKey: QueryKey;
}): QuerySnapshot {
  return {
    data: queryClient.getQueryData(queryKey),
    queryKey,
  };
}
