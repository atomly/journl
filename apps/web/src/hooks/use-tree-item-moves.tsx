"use client";

import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from "react";
import {
  TreeMoveDialog,
  TreeMoveMenuItems,
} from "~/components/tree-move-actions";
import { useMoveTreeItem } from "~/hooks/use-move-tree-item";
import {
  folderDestinationLabels,
  isValidTreeDestination,
} from "~/lib/tree-model";
import { useTRPC } from "~/trpc/react";

type MovingItem = {
  node_id: string;
  parent_node_id: string | null;
  label: string;
};
const MoveContext = createContext<((item: MovingItem) => void) | null>(null);

// Keep one picker mounted outside the rows: reparenting may remove the source
// row immediately, but pending/error feedback and keyboard focus must survive.
export function TreeMoveProvider({ children }: { children: ReactNode }) {
  const trpc = useTRPC();
  const [item, setItem] = useState<MovingItem | null>(null);
  const focusRef = useRef<HTMLElement | null>(null);
  const { mutate, isPending } = useMoveTreeItem();
  const { data: folders, isPending: loadingFolders } = useQuery({
    ...trpc.folders.getByUser.queryOptions(),
    enabled: !!item,
  });
  const destinations = (folders ?? []).flatMap((folder) =>
    folder.node_id && folder.edge_id
      ? [{ ...folder, node_id: folder.node_id }]
      : [],
  );
  const labels = folderDestinationLabels(destinations);
  return (
    <MoveContext.Provider value={setItem}>
      <section
        ref={focusRef}
        tabIndex={-1}
        aria-label="Library content"
        className="flex min-h-0 flex-1 flex-col"
      >
        {children}
      </section>
      <TreeMoveDialog
        open={!!item}
        onOpenChange={(open) => {
          if (!open) setItem(null);
        }}
        finalFocus={focusRef}
        itemLabel={item?.label ?? "item"}
        currentParentNodeId={item?.parent_node_id ?? null}
        pending={isPending || loadingFolders}
        destinations={[
          { label: "Library", nodeId: null },
          ...destinations
            .filter(
              (folder) =>
                !item ||
                isValidTreeDestination(
                  item.node_id,
                  folder.node_id,
                  destinations,
                ),
            )
            .map((folder) => ({
              label: labels.get(folder.node_id) ?? folder.name,
              nodeId: folder.node_id,
            }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        ]}
        onMove={(parentId) => {
          if (item)
            mutate(
              {
                destination: { parent_node_id: parentId, position: "after" },
                node_id: item.node_id,
              },
              { onSuccess: () => setItem(null) },
            );
        }}
      />
    </MoveContext.Provider>
  );
}

export function useTreeItemMoves(item?: MovingItem) {
  const openPicker = useContext(MoveContext);
  const { mutate, isPending, loadedItems } = useMoveTreeItem();
  if (!item) return { menuItems: null };
  const siblings = loadedItems().filter(
    (entry) => entry.parent_node_id === item.parent_node_id,
  );
  const index = siblings.findIndex((entry) => entry.node_id === item.node_id);
  const previous = index > 0 ? siblings[index - 1] : undefined;
  const next = index >= 0 ? siblings[index + 1] : undefined;
  return {
    menuItems: (
      <TreeMoveMenuItems
        disabled={isPending || !openPicker}
        onMoveUp={
          previous
            ? () =>
                mutate({
                  destination: {
                    anchor_edge_id: previous.edge_id,
                    parent_node_id: item.parent_node_id,
                    position: "before",
                  },
                  node_id: item.node_id,
                })
            : undefined
        }
        onMoveDown={
          next
            ? () =>
                mutate({
                  destination: {
                    anchor_edge_id: next.edge_id,
                    parent_node_id: item.parent_node_id,
                    position: "after",
                  },
                  node_id: item.node_id,
                })
            : undefined
        }
        onChooseFolder={() => openPicker?.(item)}
      />
    ),
  };
}
