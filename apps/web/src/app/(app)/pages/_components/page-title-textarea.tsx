"use client";

import type { Page } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { ExpandingTextarea } from "~/components/ui/expanding-textarea";
import { cn } from "~/lib/cn";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";

const DEFAULT_PLACEHOLDER = "New page";
const DEFAULT_DEBOUNCE_TIME = 150;
const MAX_TITLE_LENGTH = 100;

type NestedFolderPagesInfiniteData = {
  pageParams: unknown[];
  pages: Array<{
    items: Array<{ id: string; title: string } & Record<string, unknown>>;
    nextCursor?: string;
  }>;
};

type PageEditorTitleProps = {
  page: Pick<Page, "id" | "parent_node_id" | "title">;
  placeholder?: string;
  className?: string;
  debounceTime?: number;
  onTitleChange?: (title: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
} & Omit<React.ComponentProps<"textarea">, "value" | "onChange" | "onKeyDown">;

export function PageTitleTextarea({
  page,
  placeholder = DEFAULT_PLACEHOLDER,
  className,
  debounceTime = DEFAULT_DEBOUNCE_TIME,
  onTitleChange,
  onKeyDown,
  ref,
  ...rest
}: PageEditorTitleProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutate: updatePageTitle } = useMutation(
    trpc.pages.updateTitle.mutationOptions({}),
  );
  const [title, setTitle] = useState(page.title);
  const nestedFolderPagesQueryFilter =
    trpc.tree.getNestedPagesPaginated.infiniteQueryFilter();

  // Debounced API call for page title updates
  const debouncedUpdate = useDebouncedCallback((newTitle: string) => {
    // Optimistically update the cache
    queryClient.setQueryData(
      trpc.pages.getById.queryOptions({ id: page.id }).queryKey,
      (old) => {
        if (!old) return old;
        return {
          ...old,
          title: newTitle,
          updatedAt: new Date().toISOString(),
        };
      },
    );

    queryClient.setQueryData(
      trpc.tree.getChildrenPaginated.infiniteQueryOptions(
        getInfiniteSidebarTreeQueryOptions(page.parent_node_id ?? null),
      ).queryKey,
      (old) => {
        if (!old) return old;
        const pages = old.pages.map((treePage) => ({
          ...treePage,
          items: treePage.items.map((item) =>
            item.kind === "page" && item.page.id === page.id
              ? {
                  ...item,
                  page: {
                    ...item.page,
                    title: newTitle,
                  },
                }
              : item,
          ),
        }));
        return {
          ...old,
          pages,
        };
      },
    );

    queryClient.setQueriesData<NestedFolderPagesInfiniteData | undefined>(
      nestedFolderPagesQueryFilter,
      (old) => {
        if (!old) return old;

        return {
          ...old,
          pages: old.pages.map((nestedPage) => ({
            ...nestedPage,
            items: nestedPage.items.map((item) =>
              item.id === page.id ? { ...item, title: newTitle } : item,
            ),
          })),
        };
      },
    );

    // Execute the mutation
    updatePageTitle(
      { id: page.id, title: newTitle },
      {
        onError: () => {
          // If the mutation fails, invalidate queries to refetch correct data
          queryClient.invalidateQueries({
            queryKey: trpc.pages.getById.queryOptions({ id: page.id }).queryKey,
          });
          queryClient.invalidateQueries({
            queryKey: trpc.pages.getByUser.queryOptions().queryKey,
          });
          void queryClient.invalidateQueries(nestedFolderPagesQueryFilter);
        },
        onSuccess: () => {
          void queryClient.invalidateQueries(nestedFolderPagesQueryFilter);
        },
      },
    );
  }, debounceTime);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newTitle = e.target.value;
    setTitle(newTitle);
    onTitleChange?.(newTitle);
    debouncedUpdate(newTitle);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(e);
  }

  return (
    <ExpandingTextarea
      ref={ref}
      value={title}
      rows={1}
      maxLength={MAX_TITLE_LENGTH}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={cn(
        "border-none! bg-transparent! font-bold! text-3xl! shadow-none outline-none! ring-0! placeholder:text-muted-foreground/60 md:text-4xl! lg:text-5xl!",
        className,
      )}
      {...rest}
    />
  );
}
