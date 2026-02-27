"use client";

import type { Folder } from "@acme/db/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Loader2, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useTRPC } from "~/trpc/react";

type DeleteFolderDialogProps = {
  folder: Folder;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type DeleteFolderDialogTriggerProps = ComponentProps<typeof DialogTrigger>;

type DeleteFolderButtonProps = ComponentProps<typeof Button>;

const ROOT_FOLDER_OPTION = "__root__";

type DeleteStrategy = "delete_all" | "move";

function getDescendantFolderIds(allFolders: Folder[], folderId: string) {
  const childrenByParent = new Map<string, string[]>();

  for (const folder of allFolders) {
    if (!folder.parent_folder_id) {
      continue;
    }

    const currentChildren = childrenByParent.get(folder.parent_folder_id) ?? [];
    currentChildren.push(folder.id);
    childrenByParent.set(folder.parent_folder_id, currentChildren);
  }

  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(folderId) ?? [])];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || descendants.has(currentId)) {
      continue;
    }

    descendants.add(currentId);
    queue.push(...(childrenByParent.get(currentId) ?? []));
  }

  return descendants;
}

export function DeleteFolderButton({
  className,
  children,
  size = "sm",
  variant = "ghost",
  onClick,
  ...props
}: DeleteFolderButtonProps) {
  return (
    <Button
      aria-label="Delete folder"
      variant={variant}
      size={size}
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      {...props}
    >
      {children ?? <Trash2 />}
    </Button>
  );
}

export function DeleteFolderDialogTrigger(
  props: DeleteFolderDialogTriggerProps,
) {
  return <DialogTrigger {...props} />;
}

export function DeleteFolderDialog({
  folder,
  children,
  open,
  onOpenChange,
}: DeleteFolderDialogProps) {
  const pathname = usePathname();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [strategy, setStrategy] = useState<DeleteStrategy>("delete_all");
  const [moveToFolderId, setMoveToFolderId] = useState(ROOT_FOLDER_OPTION);
  const { data: folders = [] } = useQuery(
    trpc.folders.getByUser.queryOptions(),
  );

  const { mutate: deleteFolder, isPending: isDeleting } = useMutation(
    trpc.folders.delete.mutationOptions({}),
  );

  const isControlled = open !== undefined;
  const isDialogOpen = isControlled ? open : uncontrolledOpen;

  const setDialogOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }

      if (!nextOpen) {
        setStrategy("delete_all");
        setMoveToFolderId(ROOT_FOLDER_OPTION);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const invalidDestinationIds = useMemo(() => {
    const descendants = getDescendantFolderIds(folders, folder.id);
    descendants.add(folder.id);
    return descendants;
  }, [folder.id, folders]);

  const destinationFolders = useMemo(() => {
    return folders.filter((currentFolder) => {
      return !invalidDestinationIds.has(currentFolder.id);
    });
  }, [folders, invalidDestinationIds]);

  const showLoading = useMemo(
    () => isPending || isDeleting,
    [isDeleting, isPending],
  );
  const folderDetailsPath = `/pages/folders/${folder.id}`;

  const confirmDelete = useCallback(() => {
    startTransition(() => {
      deleteFolder(
        {
          id: folder.id,
          move_to_folder_id:
            strategy === "move"
              ? moveToFolderId === ROOT_FOLDER_OPTION
                ? null
                : moveToFolderId
              : undefined,
          strategy,
        },
        {
          onError: (error) => {
            console.error("Failed to delete folder:", error);
          },
          onSuccess: async () => {
            if (pathname === folderDetailsPath) {
              setDialogOpen(false);
              router.push("/journal");
              void queryClient.invalidateQueries({
                refetchType: "none",
              });
              return;
            }

            setDialogOpen(false);
            await queryClient.invalidateQueries();
          },
        },
      );
    });
  }, [
    deleteFolder,
    folderDetailsPath,
    folder.id,
    moveToFolderId,
    pathname,
    queryClient,
    router,
    setDialogOpen,
    strategy,
  ]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
      {children}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Folder</DialogTitle>
          <DialogDescription>
            Choose whether to delete all nested content or move direct child
            pages and folders before deleting{" "}
            {folder.name ? `"${folder.name}"` : "this folder"}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="font-medium text-sm">Delete strategy</div>
            <Select
              value={strategy}
              onValueChange={(value) => {
                setStrategy(value as DeleteStrategy);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delete_all">
                  Delete all nested content
                </SelectItem>
                <SelectItem value="move">Move direct children first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {strategy === "move" && (
            <div className="grid gap-2">
              <div className="font-medium text-sm">Move direct children to</div>
              <Select value={moveToFolderId} onValueChange={setMoveToFolderId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select destination folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_FOLDER_OPTION}>Root</SelectItem>
                  {destinationFolders.map((destinationFolder) => (
                    <SelectItem
                      key={destinationFolder.id}
                      value={destinationFolder.id}
                    >
                      <span className="flex items-center gap-2">
                        <FolderOpen className="size-3.5" />
                        {destinationFolder.name || "New folder"}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setDialogOpen(false);
            }}
            disabled={showLoading}
          >
            Cancel
          </Button>
          <Button
            autoFocus
            tabIndex={0}
            variant="destructive"
            onClick={confirmDelete}
            disabled={showLoading}
          >
            {showLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
