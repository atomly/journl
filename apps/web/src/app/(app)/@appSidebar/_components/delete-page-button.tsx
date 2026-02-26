"use client";

import type { Page } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { getInfinitePagesQueryOptions } from "~/trpc/options/pages-query-options";
import { useTRPC } from "~/trpc/react";

type DeletePageDialogProps = {
  page: Page;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type DeletePageDialogTriggerProps = ComponentProps<typeof DialogTrigger>;

type DeletePageButtonProps = ComponentProps<typeof Button>;

export function DeletePageButton({
  className,
  children,
  size = "sm",
  variant = "ghost",
  onClick,
  ...props
}: DeletePageButtonProps) {
  return (
    <Button
      aria-label="Delete page"
      variant={variant}
      size={size}
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      {...props}
    >
      {children ?? <Trash2 />}
    </Button>
  );
}

export function DeletePageDialogTrigger(props: DeletePageDialogTriggerProps) {
  return <DialogTrigger {...props} />;
}

export function DeletePageDialog({
  page,
  children,
  open,
  onOpenChange,
}: DeletePageDialogProps) {
  const pathname = usePathname();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const { mutate: deletePage, isPending: isDeleting } = useMutation(
    trpc.document.delete.mutationOptions({}),
  );

  const isControlled = open !== undefined;
  const isDialogOpen = isControlled ? open : uncontrolledOpen;

  const setDialogOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const showLoading = useMemo(
    () => isPending || isDeleting,
    [isDeleting, isPending],
  );

  const confirmDelete = useCallback(() => {
    startTransition(() => {
      deletePage(
        { id: page.document_id },
        {
          onError: (error) => {
            console.error("Failed to delete page:", error);
          },
          onSuccess: () => {
            if (pathname === `/pages/${page.id}`) {
              router.push("/journal");
            }

            queryClient.setQueryData(
              trpc.pages.getPaginated.infiniteQueryOptions(
                getInfinitePagesQueryOptions(page.folder_id ?? null),
              ).queryKey,
              (old) => {
                if (!old) {
                  return old;
                }

                return {
                  ...old,
                  pages: old.pages.map((p) => ({
                    ...p,
                    items: p.items.filter(
                      (currentPage) => currentPage.id !== page.id,
                    ),
                  })),
                };
              },
            );

            queryClient.removeQueries({
              queryKey: trpc.pages.getById.queryKey({ id: page.id }),
            });

            queryClient.cancelQueries({
              queryKey: trpc.pages.getById.queryKey({ id: page.id }),
            });

            setDialogOpen(false);
          },
        },
      );
    });
  }, [
    deletePage,
    page.document_id,
    page.id,
    pathname,
    queryClient,
    router,
    setDialogOpen,
    trpc.pages,
    page.folder_id,
  ]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
      {children}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Page</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            {page.title ? `"${page.title}"` : "this page"}? This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setDialogOpen(false);
            }}
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
            {showLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
