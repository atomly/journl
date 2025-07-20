"use client";

import type { Page } from "@acme/db/schema";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { useTRPC } from "~/trpc/react";
import { deletePageAction } from "../../pages/_actions/delete-page.action";

interface DeletePageButtonProps {
	page: Page;
	className?: string;
}

export function DeletePageButton({ page, className }: DeletePageButtonProps) {
	const pathname = usePathname();
	const router = useRouter();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();

	// Dialog state
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const [deletePageState, deletePageFormAction, isDeleting] = useActionState(
		async (
			_prevState: { pageId?: string; success?: boolean; error?: string } | null,
			formData: FormData,
		) => {
			try {
				const pageId = formData.get("pageId") as string;
				const result = await deletePageAction(pageId);
				if (!result?.deletedPage) {
					throw new Error("Failed to delete page");
				}
				return { pageId: result.deletedPage.id, success: true };
			} catch (error) {
				return {
					error:
						error instanceof Error ? error.message : "Failed to delete page",
					success: false,
				};
			}
		},
		null,
	);

	// Handle successful page deletion
	useEffect(() => {
		if (deletePageState?.success && deletePageState.pageId) {
			const deletedPageId = deletePageState.pageId;

			// Navigate away first if we're on the deleted page
			if (pathname.includes(deletedPageId)) {
				router.push("/journal");
			}

			// Remove the deleted page from the pages.all cache
			queryClient.setQueryData(
				trpc.pages.all.queryKey(),
				(oldPages: Page[] | undefined) => {
					if (!oldPages) return [];
					return oldPages.filter((p) => p.id !== deletedPageId);
				},
			);

			// Remove the specific page from cache
			queryClient.removeQueries({
				queryKey: trpc.pages.byId.queryKey({ id: deletedPageId }),
			});

			// Cancel any in-flight queries for this page
			queryClient.cancelQueries({
				queryKey: trpc.pages.byId.queryKey({ id: deletedPageId }),
			});

			// Close the dialog after successful deletion
			setIsDeleteDialogOpen(false);
		}
	}, [
		deletePageState,
		queryClient,
		trpc.pages.all,
		trpc.pages.byId,
		pathname,
		router,
	]);

	const handleDelete = () => {
		setIsDeleteDialogOpen(true);
	};

	const confirmDelete = () => {
		const formData = new FormData();
		formData.append("pageId", page.id);

		// Use startTransition to properly handle the action
		startTransition(() => {
			deletePageFormAction(formData);
		});
	};

	const cancelDelete = () => {
		setIsDeleteDialogOpen(false);
	};

	// Use transition pending state and action state for loading
	const showLoading =
		isPending || (isDeleting && deletePageState?.pageId === page.id);

	return (
		<>
			<Button
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleDelete();
				}}
				variant="ghost"
				size="sm"
				className={className}
				disabled={showLoading}
			>
				{showLoading ? <Loader2 className="animate-spin" /> : <Trash2 />}
			</Button>

			{/* Delete Confirmation Dialog */}
			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Page</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{page.title}"? This action cannot
							be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={cancelDelete}
							disabled={showLoading}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={confirmDelete}
							disabled={showLoading}
						>
							{showLoading ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
