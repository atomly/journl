"use client";

import type { Page } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { useTRPC } from "~/trpc/react";

export function CreatePageButton() {
	const router = useRouter();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();

	const { mutate: createPage, isPending: isCreating } = useMutation(
		trpc.pages.create.mutationOptions({}),
	);

	const handleCreatePage = () => {
		startTransition(() => {
			createPage(
				{
					children: [],
					title: "",
				},
				{
					onError: (error) => {
						console.error("Failed to create page:", error);
					},
					onSuccess: (newPage) => {
						// Optimistically update the pages list
						queryClient.setQueryData(
							trpc.pages.getAll.queryOptions().queryKey,
							(oldPages: Page[] | undefined) => {
								if (!oldPages) return [newPage];
								return [newPage, ...oldPages];
							},
						);

						// Navigate to the new page immediately
						router.push(`/pages/${newPage.id}`);
					},
				},
			);
		});
	};

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
						{showLoading ? "Creating..." : "New page"}
					</Button>
				</div>
			</SidebarMenuSubButton>
		</SidebarMenuSubItem>
	);
}
