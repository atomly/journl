"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { AutosizeTextarea } from "~/components/ui/autosizeable-textarea";
import { cn } from "~/lib/cn";
import { useTRPC } from "~/trpc/react";

type JournalEntryOptions = Omit<
	React.ComponentProps<"textarea">,
	"value" | "onChange"
> & {
	entryDate: Date;
	className?: string;
	initialContent?: string;
	debounceTime?: number;
};

export function JournalTextArea({
	initialContent,
	className,
	debounceTime = 400,
	entryDate,
	...rest
}: JournalEntryOptions) {
	const trpc = useTRPC();
	const { mutate } = useMutation(trpc.journal.write.mutationOptions({}));
	const debouncedMutate = useDebouncedCallback(mutate, debounceTime);

	const [content, setContent] = useState(initialContent);

	function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
		setContent(e.target.value);
		debouncedMutate({
			content: e.target.value,
			date: entryDate,
		});
	}

	return (
		<AutosizeTextarea
			value={content}
			onChange={handleChange}
			className={cn(
				"resize-none border-none bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground",
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
