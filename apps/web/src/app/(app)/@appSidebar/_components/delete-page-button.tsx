"use client";

import type { Page } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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

  const { mutate: deletePage, isPending: isDeleting } = useMutation(
    trpc.document.delete.mutationOptions({}),
  );

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    startTransition(() => {
      deletePage(
        { id: page.document_id },
        {
          onError: (error) => {
            console.error("Failed to delete page:", error);
          },
          onSuccess: () => {
            // Only navigate away if we're currently on the deleted page
            if (pathname === `/pages/${page.id}`) {
              router.push("/journal");
            }

            // Optimistically update the pages list
            queryClient.setQueryData(
              trpc.pages.getByUser.queryOptions().queryKey,
              (oldPages: Page[] | undefined) => {
                if (!oldPages) return [];
                return oldPages.filter((p) => p.id !== page.id);
              },
            );

            // Remove the specific page from cache
            queryClient.removeQueries({
              queryKey: trpc.pages.getById.queryKey({ id: page.id }),
            });

            // Cancel any in-flight queries for this page
            queryClient.cancelQueries({
              queryKey: trpc.pages.getById.queryKey({ id: page.id }),
            });

            // Close the dialog after successful deletion
            setIsDeleteDialogOpen(false);
          },
        },
      );
    });
  };

  const cancelDelete = () => {
    setIsDeleteDialogOpen(false);
  };

  const showLoading = isPending || isDeleting;

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
              tabIndex={0}
              variant="destructive"
              onClick={confirmDelete}
              disabled={showLoading}
            >
              {showLoading ? "Deleting..." : "Delete"}
            </Button>
            <Button
              variant="outline"
              onClick={cancelDelete}
              disabled={showLoading}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
