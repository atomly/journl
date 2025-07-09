"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { PageSkeleton } from "./page-skeleton";
import { PageTextArea } from "./page-text-area";
import { PageTitle } from "./page-title";

type PageEditorProps = {
	id: string;
};

export function PageEditor({ id }: PageEditorProps) {
	const trpc = useTRPC();
	const { data: page, isPending } = useQuery(
		trpc.pages.byId.queryOptions({ id }),
	);

	if (isPending) {
		return <PageSkeleton />;
	}

	return (
		<div className="flex flex-col gap-4 p-4">
			<PageTitle id={id} initialTitle={page?.title ?? ""} />
			<PageTextArea
				placeholder="Start writing your page..."
				id={id}
				initialContent={page?.content ?? ""}
			/>
		</div>
	);
}
