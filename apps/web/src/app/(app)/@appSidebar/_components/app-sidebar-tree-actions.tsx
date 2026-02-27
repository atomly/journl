"use client";

import type { Folder } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, FolderPlus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useSidebar } from "~/components/ui/sidebar";
import { cn } from "~/lib/cn";
import { getInfiniteFoldersQueryOptions } from "~/trpc/options/folders-query-options";
import { getInfinitePagesQueryOptions } from "~/trpc/options/pages-query-options";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";
import { DeleteFolderDialog } from "./delete-folder-button";

type AppSidebarTreeActionsProps = {
  className?: string;
  folder?: Folder;
  kind: "folder" | "root";
  onCreateStart?: () => void;
  onCreateSuccess?: () => void;
  parentFolderId: string | null;
};

export function AppSidebarTreeActions({
  className,
  folder,
  kind,
  onCreateStart,
  onCreateSuccess,
  parentFolderId,
}: AppSidebarTreeActionsProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { isMobile, setOpenMobile } = useSidebar();

  const { mutate: createFolder, isPending: isCreatingFolder } = useMutation(
    trpc.folders.create.mutationOptions({}),
  );
  const { mutate: createPage, isPending: isCreatingPage } = useMutation(
    trpc.pages.create.mutationOptions({}),
  );
  const nestedFolderPagesQueryFilter =
    trpc.folders.getNestedPagesPaginated.infiniteQueryFilter();

  const showLoading = isPending || isCreatingFolder || isCreatingPage;

  const handleCreateFolder = () => {
    onCreateStart?.();

    startTransition(() => {
      createFolder(
        {
          name: "New folder",
          parent_folder_id: parentFolderId,
        },
        {
          onError: (error) => {
            console.error("Failed to create folder:", error);
          },
          onSuccess: (newFolder) => {
            queryClient.setQueryData(
              trpc.folders.getPaginated.infiniteQueryOptions(
                getInfiniteFoldersQueryOptions(parentFolderId),
              ).queryKey,
              (old) => {
                if (!old) {
                  return {
                    pageParams: [],
                    pages: [
                      {
                        items: [newFolder],
                        nextCursor: undefined,
                      },
                    ],
                  };
                }

                const [first, ...rest] = old.pages;
                return {
                  ...old,
                  pages: [
                    {
                      ...first,
                      items: [newFolder, ...(first?.items ?? [])],
                      nextCursor: first?.nextCursor,
                    },
                    ...rest,
                  ],
                };
              },
            );

            queryClient.setQueryData(
              trpc.folders.getTreePaginated.infiniteQueryOptions(
                getInfiniteSidebarTreeQueryOptions(parentFolderId),
              ).queryKey,
              (old) => {
                if (!old) {
                  return {
                    pageParams: [],
                    pages: [
                      {
                        items: [{ folder: newFolder, kind: "folder" as const }],
                        nextCursor: undefined,
                      },
                    ],
                  };
                }

                const [first, ...rest] = old.pages;
                return {
                  ...old,
                  pages: [
                    {
                      ...first,
                      items: [
                        { folder: newFolder, kind: "folder" as const },
                        ...(first?.items ?? []),
                      ],
                      nextCursor: first?.nextCursor,
                    },
                    ...rest,
                  ],
                };
              },
            );

            onCreateSuccess?.();
          },
        },
      );
    });
  };

  const handleCreatePage = () => {
    onCreateStart?.();

    startTransition(() => {
      createPage(
        {
          folder_id: parentFolderId,
          title: "",
        },
        {
          onError: (error) => {
            console.error("Failed to create page:", error);
          },
          onSuccess: (newPage) => {
            queryClient.setQueryData(
              trpc.pages.getPaginated.infiniteQueryOptions(
                getInfinitePagesQueryOptions(parentFolderId),
              ).queryKey,
              (old) => {
                if (!old) {
                  return {
                    pageParams: [],
                    pages: [
                      {
                        items: [newPage],
                        nextCursor: undefined,
                      },
                    ],
                  };
                }

                const [first, ...rest] = old.pages;
                return {
                  ...old,
                  pages: [
                    {
                      ...first,
                      items: [newPage, ...(first?.items ?? [])],
                      nextCursor: first?.nextCursor,
                    },
                    ...rest,
                  ],
                };
              },
            );

            queryClient.setQueryData(
              trpc.folders.getTreePaginated.infiniteQueryOptions(
                getInfiniteSidebarTreeQueryOptions(parentFolderId),
              ).queryKey,
              (old) => {
                if (!old) {
                  return {
                    pageParams: [],
                    pages: [
                      {
                        items: [{ kind: "page" as const, page: newPage }],
                        nextCursor: undefined,
                      },
                    ],
                  };
                }

                const [first, ...rest] = old.pages;
                return {
                  ...old,
                  pages: [
                    {
                      ...first,
                      items: [
                        { kind: "page" as const, page: newPage },
                        ...(first?.items ?? []),
                      ],
                      nextCursor: first?.nextCursor,
                    },
                    ...rest,
                  ],
                };
              },
            );

            onCreateSuccess?.();
            void queryClient.invalidateQueries(nestedFolderPagesQueryFilter);

            if (isMobile) {
              setOpenMobile(false);
            }

            router.push(`/pages/${newPage.id}`);
          },
        },
      );
    });
  };

  const menu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Add item"
          variant="ghost"
          size="sm"
          className={cn(
            "absolute top-1/2 right-1.5 z-10 h-6 w-6 -translate-y-1/2 rounded-sm p-0 text-sidebar-foreground transition-opacity hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden md:pointer-events-none md:opacity-0 md:group-hover/tree-row:pointer-events-auto md:group-hover/tree-row:opacity-100 md:group-focus-within/tree-row:pointer-events-auto md:group-focus-within/tree-row:opacity-100",
            className,
          )}
          onClick={(event) => {
            event.stopPropagation();
          }}
          disabled={showLoading}
        >
          <Plus className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={isMobile ? "bottom" : "right"}
        sideOffset={6}
      >
        <DropdownMenuItem
          onSelect={() => {
            handleCreatePage();
          }}
          disabled={showLoading}
        >
          <FilePlus2 />
          New page
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            handleCreateFolder();
          }}
          disabled={showLoading}
        >
          <FolderPlus />
          New folder
        </DropdownMenuItem>
        {kind === "folder" ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 />
            Delete folder
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (kind !== "folder" || !folder) {
    return menu;
  }

  return (
    <DeleteFolderDialog
      folder={folder}
      open={isDeleteDialogOpen}
      onOpenChange={setIsDeleteDialogOpen}
    >
      {menu}
    </DeleteFolderDialog>
  );
}
