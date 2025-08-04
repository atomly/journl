"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forwardRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "~/components/ui/input";
import { cn } from "~/components/utils";
import { useTRPC } from "~/trpc/react";

type EditorTitleProps = {
	parentId: string;
	parentType: "page" | "journal_entry" | "block";
	title?: string;
	placeholder?: string;
	className?: string;
	debounceTime?: number;
	onTitleChange?: (title: string) => void;
	onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "onKeyDown">;

export const EditorTitle = forwardRef<HTMLInputElement, EditorTitleProps>(
	(
		{
			parentId,
			parentType,
			title = "",
			placeholder = "Untitled",
			className,
			debounceTime = 400,
			onTitleChange,
			onKeyDown,
			...rest
		},
		ref,
	) => {
		const trpc = useTRPC();
		const queryClient = useQueryClient();

		// Only pages can be edited
		const isEditable = parentType === "page";

		// Mutation for updating page titles
		const { mutate: updatePageTitle } = useMutation(
			trpc.pages.updateTitle.mutationOptions({}),
		);

		// Use local state only, initialized with the title prop
		const [localTitle, setLocalTitle] = useState(title);

		// Debounced API call for page title updates
		const debouncedUpdate = useDebouncedCallback((newTitle: string) => {
			if (!isEditable) return;

			// Optimistically update the cache
			queryClient.setQueryData(
				trpc.pages.getById.queryOptions({ id: parentId }).queryKey,
				(old: any) => {
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
				(old: any) => {
					if (!old) return old;
					return old.map((page: any) =>
						page.id === parentId
							? {
									...page,
									title: newTitle,
									updatedAt: new Date().toISOString(),
								}
							: page,
					);
				},
			);

			// Execute the mutation
			updatePageTitle(
				{ id: parentId, title: newTitle || "" },
				{
					onError: () => {
						// If the mutation fails, invalidate queries to refetch correct data
						queryClient.invalidateQueries({
							queryKey: trpc.pages.getById.queryOptions({ id: parentId })
								.queryKey,
						});
						queryClient.invalidateQueries({
							queryKey: trpc.pages.getAll.queryOptions().queryKey,
						});
					},
				},
			);
		}, debounceTime);

		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			const newTitle = e.target.value;
			setLocalTitle(newTitle);
			onTitleChange?.(newTitle);

			// Only trigger API update for pages
			if (isEditable) {
				debouncedUpdate(newTitle || "");
			}
		};

		const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
			// Only call the parent onKeyDown if editing is allowed
			if (isEditable) {
				onKeyDown?.(e);
			}
		};

		return (
			<Input
				ref={ref}
				value={localTitle}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				readOnly={!isEditable}
				className={cn(
					"!bg-transparent !outline-none !ring-0 !text-3xl border-none px-0 font-bold placeholder:text-muted-foreground/60",
					!isEditable && "cursor-default",
					className,
				)}
				{...rest}
			/>
		);
	},
);

EditorTitle.displayName = "EditorTitle";
