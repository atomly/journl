"use client";

import type { Folder } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "~/components/ui/input";
import { updateNode } from "~/trpc/cache/tree-cache";
import { useTRPC } from "~/trpc/react";

const DEFAULT_PLACEHOLDER = "New folder";
const DEFAULT_DEBOUNCE_TIME = 150;

type FolderTitleInputProps = {
  folder: Pick<Folder, "id" | "name" | "node_id" | "parent_node_id">;
  debounceTime?: number;
  placeholder?: string;
};

export function FolderTitleInput({
  folder,
  debounceTime = DEFAULT_DEBOUNCE_TIME,
  placeholder = DEFAULT_PLACEHOLDER,
}: FolderTitleInputProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutate: renameFolder } = useMutation(
    trpc.folders.rename.mutationOptions({}),
  );
  const [title, setTitle] = useState(folder.name);
  const treeQueryFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();

  const debouncedRenameFolder = useDebouncedCallback((newTitle: string) => {
    queryClient.setQueryData(
      trpc.folders.getById.queryOptions({ id: folder.id }).queryKey,
      (old) => {
        if (!old) {
          return old;
        }

        return {
          ...old,
          name: newTitle,
          updated_at: new Date().toISOString(),
        };
      },
    );

    queryClient.setQueryData(
      trpc.folders.getByUser.queryOptions().queryKey,
      (old) => {
        if (!old) {
          return old;
        }

        return old.map((item) =>
          item.id === folder.id ? { ...item, name: newTitle } : item,
        );
      },
    );

    if (folder.node_id) {
      updateNode({
        nodeId: folder.node_id,
        queryClient,
        queryFilter: treeQueryFilter,
        updater: (item) =>
          item.kind === "folder"
            ? {
                ...item,
                folder: {
                  ...item.folder,
                  name: newTitle,
                },
              }
            : item,
      });
    }

    renameFolder(
      {
        id: folder.id,
        name: newTitle,
      },
      {
        onError: () => {
          void queryClient.invalidateQueries({
            queryKey: trpc.folders.getById.queryOptions({ id: folder.id })
              .queryKey,
          });
          void queryClient.invalidateQueries({
            queryKey: trpc.folders.getByUser.queryOptions().queryKey,
          });
          void queryClient.invalidateQueries(treeQueryFilter);
        },
      },
    );
  }, debounceTime);

  return (
    <Input
      value={title}
      onChange={(event) => {
        const newTitle = event.target.value;
        setTitle(newTitle);
        debouncedRenameFolder(newTitle);
      }}
      placeholder={placeholder}
      className="h-11 text-lg"
    />
  );
}
