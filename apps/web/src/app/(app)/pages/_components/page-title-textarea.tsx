"use client";

import type { Page } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { ExpandingTextarea } from "~/components/ui/expanding-textarea";
import { PageCreatedEvent } from "~/events/page-created-event";
import { useAppEventHandler } from "~/hooks/use-app-event-handler";
import { cn } from "~/lib/cn";
import {
  updateNode,
  updatePageTitleInNestedPages,
} from "~/trpc/cache/tree-cache";
import { useTRPC } from "~/trpc/react";

const DEFAULT_PLACEHOLDER = "New page";
const DEFAULT_DEBOUNCE_TIME = 150;
const MAX_TITLE_LENGTH = 100;

type PageEditorTitleProps = {
  page: Pick<Page, "id" | "node_id" | "parent_node_id" | "title">;
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
  ...rest
}: PageEditorTitleProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutate: updatePageTitle } = useMutation(
    trpc.pages.updateTitle.mutationOptions({}),
  );
  const [title, setTitle] = useState(page.title);
  const treeQueryFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();
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

    if (page.node_id) {
      updateNode({
        nodeId: page.node_id,
        queryClient,
        queryFilter: treeQueryFilter,
        updater: (item) =>
          item.kind === "page"
            ? {
                ...item,
                page: {
                  ...item.page,
                  title: newTitle,
                },
              }
            : item,
      });
    }

    updatePageTitleInNestedPages({
      pageId: page.id,
      queryClient,
      queryFilter: nestedFolderPagesQueryFilter,
      title: newTitle,
    });

    // Execute the mutation
    updatePageTitle(
      { id: page.id, title: newTitle },
      {
        onError: () => {
          // If the mutation fails, invalidate queries to refetch correct data
          queryClient.invalidateQueries({
            queryKey: trpc.pages.getById.queryOptions({ id: page.id }).queryKey,
          });
          queryClient.invalidateQueries(treeQueryFilter);
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

  useAppEventHandler(
    ({ payload }) => {
      if (!payload.title && ref.current) {
        ref.current.focus();
      }
    },
    [PageCreatedEvent, page.id],
  );

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
