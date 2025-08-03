"use client";

import { useQuery } from "@tanstack/react-query";
import { LazyBlockEditor } from "~/components/editor/lazy-block-editor";
import { useTRPC } from "~/trpc/react";
import { PageSkeleton } from "./page-skeleton";
import { PageTitle } from "./page-title";

type PageEditorProps = {
	id: string;
};

export function PageEditor({ id }: PageEditorProps) {
	const trpc = useTRPC();

	const { data: page, isLoading } = useQuery({
		...trpc.pages.getById.queryOptions({ id }),
		// Refetch once when navigating to a page (not continuously)
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		staleTime: 1000,
	});

	// Show loading indicator when initially loading OR when refetching
	if (isLoading) {
		return <PageSkeleton />;
	}

	if (!page) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-muted-foreground">Page not found</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-full flex-col gap-4 p-4">
			<PageTitle id={id} initialTitle={page.title ?? ""} />
			<div className="min-h-0 flex-1">
				<LazyBlockEditor parentId={id} parentType="page" />
			</div>
		</div>
	);
}
