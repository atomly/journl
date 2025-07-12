"use client";

import type { Page } from "@acme/db/schema";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { useTRPC } from "~/trpc/react";
import { createPageAction } from "../../pages/_actions/create-page.action";

export function CreatePageButton() {
	const router = useRouter();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();

	const [newPageState, newPageFormAction, isCreating] = useActionState(
		async () => {
			try {
				const newPage = await createPageAction();
				return { page: newPage, success: true };
			} catch (error) {
				return {
					error:
						error instanceof Error ? error.message : "Failed to create page",
					success: false,
				};
			}
		},
		null,
	);

	// Handle successful page creation
	useEffect(() => {
		if (newPageState?.success && newPageState.page) {
			// Add the new page to the existing cache instead of invalidating
			queryClient.setQueryData(
				trpc.pages.all.queryKey(),
				(oldPages: Page[] | undefined) => {
					if (!oldPages) return [newPageState.page];
					// Add the new page at the beginning (most recent first)
					return [newPageState.page, ...oldPages];
				},
			);

			// Pre-populate the pages.byId cache for the new page to prevent race conditions
			queryClient.setQueryData(
				trpc.pages.byId.queryKey({ id: newPageState.page.id }),
				newPageState.page,
			);

			// Navigate to the new page
			router.push(`/pages/${newPageState.page.id}`);
		}
	}, [newPageState, queryClient, trpc.pages.all, trpc.pages.byId, router]);

	const handleCreatePage = () => {
		startTransition(() => {
			newPageFormAction();
		});
	};

	// Use transition pending state and action state for loading
	const showLoading = isPending || isCreating;

	return (
		<SidebarMenuSubItem>
			<SidebarMenuSubButton asChild>
				<div className="border-2 border-sidebar-border border-dashed">
					<Button
						variant="ghost"
						className="w-full flex-row justify-start"
						onClick={handleCreatePage}
						disabled={showLoading}
					>
						<Plus />
						{showLoading ? "Creating..." : "New Page"}
					</Button>
				</div>
			</SidebarMenuSubButton>
		</SidebarMenuSubItem>
	);
}
