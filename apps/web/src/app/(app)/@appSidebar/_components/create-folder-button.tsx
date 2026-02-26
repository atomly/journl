"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { getInfiniteFoldersQueryOptions } from "~/trpc/options/folders-query-options";
import { useTRPC } from "~/trpc/react";

type CreateFolderButtonProps = {
  className?: string;
  parentFolderId?: string | null;
};

export function CreateFolderButton({
  className,
  parentFolderId,
}: CreateFolderButtonProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const { mutate: createFolder, isPending: isCreating } = useMutation(
    trpc.folders.create.mutationOptions({}),
  );

  const handleCreateFolder = () => {
    startTransition(() => {
      createFolder(
        {
          name: "New folder",
          parent_folder_id: parentFolderId ?? null,
        },
        {
          onError: (error) => {
            console.error("Failed to create folder:", error);
          },
          onSuccess: (newFolder) => {
            queryClient.setQueryData(
              trpc.folders.getPaginated.infiniteQueryOptions(
                getInfiniteFoldersQueryOptions(parentFolderId ?? null),
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
          },
        },
      );
    });
  };

  const showLoading = isPending || isCreating;

  return (
    <SidebarMenuSubItem className={className}>
      <SidebarMenuSubButton asChild>
        <Button
          variant="ghost"
          className="w-full flex-row items-center justify-center border-2 border-sidebar-border border-dashed px-0!"
          onClick={handleCreateFolder}
          disabled={showLoading}
        >
          <FolderPlus className="-ms-4 size-4" />
          <span>{showLoading ? "Creating..." : "New folder"}</span>
        </Button>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
