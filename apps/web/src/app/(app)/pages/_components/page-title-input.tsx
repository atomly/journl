"use client";

import type { Page } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "~/components/ui/input";
import { cn } from "~/components/utils";
import { useTRPC } from "~/trpc/react";

type PageEditorTitleProps = {
  page: Pick<Page, "id" | "title">;
  placeholder?: string;
  className?: string;
  debounceTime?: number;
  onTitleChange?: (title: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "onKeyDown">;

export function PageTitleInput({
  page,
  placeholder = "New page",
  className,
  debounceTime = 150,
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

    // Update the pages.getAll query cache
    queryClient.setQueryData(
      trpc.pages.getAll.queryOptions().queryKey,
      (old) => {
        if (!old) return old;
        return old.map((p) =>
          p.id === page.id
            ? {
                ...p,
                title: newTitle,
              }
            : p,
        );
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
            queryKey: trpc.pages.getAll.queryOptions().queryKey,
          });
        },
      },
    );
  }, debounceTime);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTitle = e.target.value;
    setTitle(newTitle);
    onTitleChange?.(newTitle);
    debouncedUpdate(newTitle);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(e);
  }

  return (
    <Input
      ref={ref}
      value={title}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={cn(
        "!bg-transparent !outline-none !ring-0 !text-3xl border-none px-0 font-bold placeholder:text-muted-foreground/60",
        className,
      )}
      {...rest}
    />
  );
}
