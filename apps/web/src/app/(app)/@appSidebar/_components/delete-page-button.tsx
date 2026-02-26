"use client";

import type { Page } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
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
import { infinitePagesQueryOptions } from "~/trpc/options/pages-query-options";
import { useTRPC } from "~/trpc/react";

interface DeletePageButtonProps {
  page: Page;
  className?: string;
  children?: ReactNode;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
}

export function DeletePageButton({
  page,
  className,
  children,
  size = "sm",
  variant = "ghost",
}: DeletePageButtonProps) {
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
              trpc.pages.getPaginated.infiniteQueryOptions(
                infinitePagesQueryOptions,
              ).queryKey,
              (old) => {
                if (!old) return old;
                return {
                  ...old,
                  pages: old.pages.map((p) => ({
                    ...p,
                    items: p.items.filter((p) => p.id !== page.id),
                  })),
                };
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
        aria-label="Delete page"
        variant={variant}
        size={size}
        className={className}
        disabled={showLoading}
      >
        {showLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          (children ?? <Trash2 />)
        )}
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
              autoFocus
              tabIndex={0}
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
