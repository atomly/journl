"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { useTRPC } from "~/trpc/react";
import { infinitePagesQueryOptions } from "../../../api/trpc/options/pages-query-options";

type CreatePageButtonProps = {
  className?: string;
};

export function CreatePageButton({ className }: CreatePageButtonProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const { mutate: createPage, isPending: isCreating } = useMutation(
    trpc.pages.create.mutationOptions({}),
  );

  const handleCreatePage = () => {
    startTransition(() => {
      createPage(
        {
          title: "",
        },
        {
          onError: (error) => {
            console.error("Failed to create page:", error);
          },
          onSuccess: (newPage) => {
            // Optimistically update the pages list
            queryClient.setQueryData(
              trpc.pages.getPaginated.infiniteQueryOptions(
                infinitePagesQueryOptions,
              ).queryKey,
              (old) => {
                if (!old)
                  return {
                    pageParams: [],
                    pages: [
                      {
                        items: [newPage],
                        nextCursor: undefined,
                      },
                    ],
                  };
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

            // Navigate to the new page immediately
            router.push(`/pages/${newPage.id}`);
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
          onClick={handleCreatePage}
          disabled={showLoading}
        >
          <Plus className="-ms-4 size-4" />
          <span>{showLoading ? "Creating..." : "New page"}</span>
        </Button>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
