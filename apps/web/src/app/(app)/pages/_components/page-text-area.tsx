"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { FullHeightTextarea } from "~/components/ui/full-height-textarea";
import { cn } from "~/components/utils";
import { useTRPC } from "~/trpc/react";

type PageTextAreaProps = Omit<
	React.ComponentProps<"textarea">,
	"value" | "onChange"
> & {
	id: string;
	initialContent: string;
	className?: string;
	debounceTime?: number;
};

export function PageTextArea({
	id,
	initialContent,
	className,
	debounceTime = 400,
	...rest
}: PageTextAreaProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { mutate } = useMutation(
		trpc.pages.updateContent.mutationOptions({
			onSuccess: (data) => {
				// Update cache only after successful mutation
				if (!data) return;

				queryClient.setQueryData(
					trpc.pages.byId.queryOptions({ id }).queryKey,
					(old) => {
						if (!old) return old;
						return {
							...old,
							content: data.content,
							updated_at: data.updated_at,
						};
					},
				);
			},
		}),
	);

	const debouncedMutate = useDebouncedCallback(mutate, debounceTime);

	// Only use initialContent on mount, then rely on client state
	const [content, setContent] = useState(initialContent);

	function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
		setContent(e.target.value);
		debouncedMutate({ content: e.target.value, id });
	}

	return (
		<FullHeightTextarea
			value={content}
			onChange={handleChange}
			className={cn(
				"!bg-transparent !ring-0 resize-none border-none p-0 leading-relaxed outline-none placeholder:text-muted-foreground/80",
				className,
			)}
			onInput={(e) => {
				const target = e.target as HTMLTextAreaElement;
				target.style.height = "0px";
				target.style.height = `${target.scrollHeight}px`;
			}}
			{...rest}
		/>
	);
}
