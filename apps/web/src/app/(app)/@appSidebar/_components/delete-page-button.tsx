"use client";

import type { Page } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
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
import {
  type QuerySnapshot,
  removeNode,
  removePageFromNestedPages,
  restoreQueries,
  snapshotQueries,
  snapshotQuery,
} from "~/trpc/cache/tree-cache";
import { useTRPC } from "~/trpc/react";

type DeletePageDialogProps = {
  page: Page;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type DeletePageDialogTriggerProps = ComponentProps<typeof DialogTrigger>;

type DeletePageButtonProps = ComponentProps<typeof Button>;

type DeletePageMutationContext = {
  pageSnapshot: QuerySnapshot;
  nestedSnapshots: QuerySnapshot[];
  treeSnapshots: QuerySnapshot[];
};

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
  const deletePageContextRef = useRef<DeletePageMutationContext | null>(null);
  const treeQueryFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();
  const nestedFolderPagesQueryFilter =
    trpc.tree.getNestedPagesPaginated.infiniteQueryFilter();
  const pageQueryKey = trpc.pages.getById.queryKey({ id: page.id });

  const { mutate: deletePage, isPending: isDeleting } = useMutation(
    trpc.document.delete.mutationOptions({
      onError: (error) => {
        const context = deletePageContextRef.current;
        if (context) {
          restoreQueries({
            queryClient,
            snapshots: context.treeSnapshots,
          });
          restoreQueries({
            queryClient,
            snapshots: context.nestedSnapshots,
          });
          restoreQueries({
            queryClient,
            snapshots: [context.pageSnapshot],
          });
        }
        deletePageContextRef.current = null;

        console.error("Failed to delete page:", error);
      },
      onMutate: async () => {
        await Promise.all([
          queryClient.cancelQueries(treeQueryFilter),
          queryClient.cancelQueries(nestedFolderPagesQueryFilter),
          queryClient.cancelQueries({ queryKey: pageQueryKey }),
        ]);

        const treeSnapshots = snapshotQueries({
          queryClient,
          queryFilter: treeQueryFilter,
        });
        const nestedSnapshots = snapshotQueries({
          queryClient,
          queryFilter: nestedFolderPagesQueryFilter,
        });
        const pageSnapshot = snapshotQuery({
          queryClient,
          queryKey: pageQueryKey,
        });

        if (page.node_id) {
          removeNode({
            nodeId: page.node_id,
            queryClient,
            queryFilter: treeQueryFilter,
          });
        }

        removePageFromNestedPages({
          pageId: page.id,
          queryClient,
          queryFilter: nestedFolderPagesQueryFilter,
        });

        queryClient.removeQueries({ exact: true, queryKey: pageQueryKey });

        deletePageContextRef.current = {
          nestedSnapshots,
          pageSnapshot,
          treeSnapshots,
        };
      },
      onSuccess: () => {
        deletePageContextRef.current = null;

        if (pathname === `/pages/${page.id}`) {
          router.push("/journal");
        }

        setDialogOpen(false);
      },
    }),
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
      deletePage({ id: page.document_id });
    });
  }, [deletePage, page.document_id]);

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
