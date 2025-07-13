"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTRPC } from "~/trpc/react";
import { PageBlocks } from "./page-blocks";
import { PageSkeleton } from "./page-skeleton";
import { PageTitle } from "./page-title";

type PageEditorProps = {
	id: string;
};

export function PageEditor({ id }: PageEditorProps) {
	const trpc = useTRPC();
	const router = useRouter();
	const {
		data: page,
		isPending,
		error,
	} = useQuery(trpc.pages.byId.queryOptions({ id }));

	// Handle page not found error by redirecting to home
	useEffect(() => {
		if (error?.message === "Page not found") {
			router.push("/home");
		}
	}, [error, router]);

	if (isPending) {
		return <PageSkeleton />;
	}

	// If page doesn't exist (deleted or never existed), don't render anything
	// The useEffect above will handle the redirect
	if (!page || error) {
		return <PageSkeleton />;
	}
	const content = page.content as string[];
	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<PageTitle id={id} initialTitle={page.title ?? ""} />
			<div className="min-h-0 flex-1">
				<PageBlocks
					initialRange={{
						cursor: content[0] ?? undefined,
						limit: 50,
					}}
					parentId={id}
					parentType="page"
				/>
			</div>
		</div>
	);
}
