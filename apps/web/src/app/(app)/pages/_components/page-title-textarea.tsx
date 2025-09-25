"use client";

import type { Page } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { FullHeightTextarea } from "~/components/ui/full-height-textarea";
import { cn } from "~/components/utils";
import { PAGES_INFINITE_QUERY_CONFIG } from "~/lib/pages-config";
import { useTRPC } from "~/trpc/react";

const DEFAULT_PLACEHOLDER = "New page";
const DEFAULT_DEBOUNCE_TIME = 150;

type PageEditorTitleProps = {
  page: Pick<Page, "id" | "title">;
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

    // Update the pages.getInfinite query cache from sidebar
    queryClient.setQueryData(
      trpc.pages.getInfinite.infiniteQueryOptions(PAGES_INFINITE_QUERY_CONFIG)
        .queryKey,
      (old) => {
        if (!old) return old;
        const pages = old.pages.map((p) => ({
          ...p,
          items: p.items.map((item) =>
            item.id === page.id ? { ...item, title: newTitle } : item,
          ),
        }));
        return {
          ...old,
          pages,
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
    <FullHeightTextarea
      ref={ref}
      value={title}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={cn(
        "!bg-transparent !h-auto !outline-none !ring-0 !text-3xl !border-none !font-bold md:!text-4xl lg:!text-5xl placeholder:text-muted-foreground/60",
        className,
      )}
      {...rest}
    />
  );
}
