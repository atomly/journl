"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "~/components/ui/input";
import { cn } from "~/components/utils";
import { useTRPC } from "~/trpc/react";

type PageTitleProps = Omit<
	React.ComponentProps<"input">,
	"value" | "onChange"
> & {
	id: string;
	initialTitle: string;
	debounceTime?: number;
};

export function PageTitle({
	id,
	initialTitle,
	className,
	debounceTime = 400,
	...rest
}: PageTitleProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { mutate } = useMutation(trpc.pages.updateTitle.mutationOptions({}));

	const debouncedMutate = useDebouncedCallback(
		(variables: { id: string; title: string }) => {
			// Optimistically update the cache before the mutation
			queryClient.setQueryData(
				trpc.pages.byId.queryOptions({ id }).queryKey,
				(old) => {
					if (!old) return old;
					return {
						...old,
						title: variables.title,
						updatedAt: new Date().toISOString(),
					};
				},
			);

			// update the pages.all query
			queryClient.setQueryData(
				trpc.pages.all.queryOptions().queryKey,
				(old) => {
					if (!old) return old;
					return old.map((page) =>
						page.id === id
							? {
									...page,
									title: variables.title,
									updatedAt: new Date().toISOString(),
								}
							: page,
					);
				},
			);

			// Execute the mutation
			mutate(variables, {
				onError: () => {
					// If the mutation fails, invalidate queries to refetch the correct data
					queryClient.invalidateQueries({
						queryKey: trpc.pages.byId.queryOptions({ id }).queryKey,
					});
					queryClient.invalidateQueries({
						queryKey: trpc.pages.all.queryOptions().queryKey,
					});
				},
			});
		},
		debounceTime,
	);

	// Only use initialTitle on mount, then rely on client state
	const [title, setTitle] = useState(initialTitle);

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		setTitle(e.target.value);
		debouncedMutate({ id, title: e.target.value });
	}

	return (
		<Input
			className={cn(
				"!bg-transparent !ring-0 !text-3xl resize-none border-none p-0 font-bold leading-relaxed outline-none placeholder:text-muted-foreground/80",
				className,
			)}
			value={title}
			onChange={handleChange}
			{...rest}
		/>
	);
}
