"use client";

import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { Input } from "@acme/ui/input";
import { cn } from "@acme/ui/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  FileText,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { LibraryPage } from "~/trpc";
import { useTRPC } from "~/trpc/react";
import { DeletePageDialog } from "../../@appSidebar/_components/delete-page-button";

export type FolderTone = "mint" | "peach" | "neutral";

export type LibraryRowMove = {
  label: string;
  node_id: string;
  parent_node_id: string | null;
};

const MAX_PAGE_TITLE_LENGTH = 500;

type LibraryPageRowProps = {
  page: LibraryPage;
  tone: FolderTone;
  onMoveToFolder: (item: LibraryRowMove) => void;
};

export function LibraryPageRow({
  page,
  tone,
  onMoveToFolder,
}: LibraryPageRowProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(page.title);
  const [titleError, setTitleError] = useState(false);
  const shouldSkipBlurCommitRef = useRef(false);
  const titleVersionRef = useRef(page.updated_at);
  const treeQueryFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();
  const nestedFolderPagesQueryFilter =
    trpc.tree.getNestedPagesPaginated.infiniteQueryFilter();

  const pageHref = `/pages/${page.id}`;
  const isActive = pathname === pageHref;

  const { mutate: updatePageTitle } = useMutation(
    trpc.pages.updateTitle.mutationOptions({}),
  );
  const { mutate: duplicatePage, isPending: isDuplicating } = useMutation(
    trpc.pages.duplicate.mutationOptions({
      onError: () =>
        toast.error("Couldn't duplicate the page. Please try again."),
      onSettled: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.pages.getAll.pathKey(),
        });
        void queryClient.invalidateQueries(treeQueryFilter);
      },
    }),
  );

  useEffect(() => {
    if (!isEditing && !titleError) setDraftTitle(page.title);
  }, [page.title, titleError, isEditing]);

  const invalidateTitleCaches = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.pages.getById.pathKey(),
    });
    void queryClient.invalidateQueries(treeQueryFilter);
    void queryClient.invalidateQueries(nestedFolderPagesQueryFilter);
    void queryClient.invalidateQueries({
      queryKey: trpc.pages.getAll.pathKey(),
    });
  }, [
    nestedFolderPagesQueryFilter,
    queryClient,
    treeQueryFilter,
    trpc.pages.getById,
    trpc.pages.getAll,
  ]);

  const commitTitle = useCallback(
    (nextTitle: string) => {
      setTitleError(false);
      if (nextTitle === page.title) return;
      updatePageTitle(
        {
          expected_updated_at: titleVersionRef.current,
          id: page.id,
          title: nextTitle,
        },
        {
          onError: () => {
            setDraftTitle(nextTitle);
            setIsEditing(true);
            setTitleError(true);
            invalidateTitleCaches();
          },
          onSuccess: (saved) => {
            titleVersionRef.current = saved.updated_at;
            setIsEditing(false);
            invalidateTitleCaches();
          },
        },
      );
    },
    [invalidateTitleCaches, page.id, page.title, updatePageTitle],
  );

  const actionsMenu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${page.title || "New page"}`}
            className="journl-library-actions group-focus-within/library-row:pointer-events-auto group-focus-within/library-row:opacity-100 group-hover/library-row:pointer-events-auto group-hover/library-row:opacity-100 aria-expanded:pointer-events-auto aria-expanded:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:pointer-events-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0"
          >
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              titleVersionRef.current = page.updated_at;
              setTitleError(false);
              setDraftTitle(page.title);
              setIsEditing(true);
            }}
          >
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!page.node_id}
            onClick={() => {
              if (!page.node_id) return;
              onMoveToFolder({
                label: page.title || "New page",
                node_id: page.node_id,
                parent_node_id: page.parent_node_id ?? null,
              });
            }}
          >
            <FolderInput />
            Move to folder
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isDuplicating}
            onClick={() => {
              duplicatePage({ id: page.id });
            }}
          >
            <Copy />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const nameCell: ReactNode = isEditing ? (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <Input
        autoFocus
        maxLength={MAX_PAGE_TITLE_LENGTH}
        value={draftTitle}
        aria-label="Page title"
        onBlur={() => {
          if (shouldSkipBlurCommitRef.current) {
            shouldSkipBlurCommitRef.current = false;
            return;
          }
          setIsEditing(false);
          commitTitle(draftTitle);
        }}
        onChange={(event) => {
          setDraftTitle(event.target.value);
        }}
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            shouldSkipBlurCommitRef.current = true;
            setDraftTitle(page.title);
            setIsEditing(false);
          }
        }}
        placeholder="New page"
        className="h-8 w-full"
      />
      {titleError ? (
        <span role="alert" className="journl-library-rename-error">
          Title not saved. Your draft is kept; copy it before leaving.
        </span>
      ) : null}
    </span>
  ) : (
    <Link
      draggable={false}
      href={pageHref}
      aria-current={isActive ? "page" : undefined}
    >
      <FileText aria-hidden="true" />
      <strong className="truncate">{page.title || "New page"}</strong>
    </Link>
  );

  return (
    <DeletePageDialog
      page={page}
      open={isDeleteDialogOpen}
      onOpenChange={(open) => {
        setIsDeleteDialogOpen(open);
        if (!open) {
          void queryClient.invalidateQueries({
            queryKey: trpc.pages.getAll.pathKey(),
          });
        }
      }}
    >
      <div
        role="row"
        data-active={isActive || undefined}
        className="journl-library-grid journl-library-row group/library-row"
      >
        <div role="cell" className="journl-library-name">
          {nameCell}
        </div>
        <div role="cell">
          {page.folder_name ? (
            <span
              className={cn("journl-library-badge", tone !== "neutral" && tone)}
            >
              {page.folder_name}
            </span>
          ) : null}
        </div>
        <div role="cell">{actionsMenu}</div>
      </div>
    </DeletePageDialog>
  );
}
