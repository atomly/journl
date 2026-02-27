"use client";

import type { Folder, Page } from "@acme/db/schema";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight, FileText, Folder as FolderIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/cn";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";
import {
  DeletePageButton,
  DeletePageDialog,
  DeletePageDialogTrigger,
} from "../../../@appSidebar/_components/delete-page-button";

const INFINITE_SCROLL_ROOT_MARGIN = "200px 0px";
const NESTED_LEVEL_CLASSNAME = "ml-6 border-sidebar-border/50 border-l pl-3";
const ROW_CLASSNAME =
  "group flex items-center gap-2 rounded-sm px-3 py-2 transition-colors hover:bg-muted/60";

type FolderNestedPagesListProps = {
  rootFolderId?: string | null;
};

type TreeLevelProps = {
  parentFolderId: string | null;
  nested?: boolean;
};

function FolderTreePageRow({ page }: { page: Page }) {
  return (
    <DeletePageDialog page={page}>
      <div className={ROW_CLASSNAME}>
        <Link
          href={`/pages/${page.id}`}
          className="flex min-w-0 flex-1 items-center justify-between gap-2"
        >
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{page.title || "New page"}</span>
          </span>
          <span className="shrink-0 text-muted-foreground text-xs">
            {new Date(page.updated_at).toLocaleDateString()}
          </span>
        </Link>
        <DeletePageDialogTrigger asChild>
          <DeletePageButton className="h-7 w-7 shrink-0 p-0 text-destructive opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100" />
        </DeletePageDialogTrigger>
      </div>
    </DeletePageDialog>
  );
}

function FolderTreeFolderRow({ folder }: { folder: Folder }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-1">
      <div className={ROW_CLASSNAME}>
        <button
          type="button"
          onClick={() => {
            setIsOpen((prev) => !prev);
          }}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
          aria-label={isOpen ? "Collapse folder" : "Expand folder"}
        >
          <ChevronRight
            className={cn("size-3 transition-transform", isOpen && "rotate-90")}
          />
        </button>

        <Link
          href={`/pages/folders/${folder.id}`}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{folder.name || "New folder"}</span>
        </Link>
      </div>

      {isOpen ? <FolderTreeLevel parentFolderId={folder.id} nested /> : null}
    </div>
  );
}

function FolderTreeLevel({ parentFolderId, nested = false }: TreeLevelProps) {
  const trpc = useTRPC();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const queryOptions = trpc.folders.getTreePaginated.infiniteQueryOptions(
    getInfiniteSidebarTreeQueryOptions(parentFolderId),
  );

  const { data, status, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      ...queryOptions,
      getNextPageParam: (lastPage) => {
        return lastPage.nextCursor;
      },
    });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const target = loadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void fetchNextPage();
        }
      },
      {
        rootMargin: INFINITE_SCROLL_ROOT_MARGIN,
      },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const shouldShowInitialSkeleton = items.length === 0 && status === "pending";

  return (
    <div className={cn("space-y-1", nested && NESTED_LEVEL_CLASSNAME)}>
      {shouldShowInitialSkeleton ? (
        <>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </>
      ) : null}

      {items.map((item) =>
        item.kind === "folder" ? (
          <FolderTreeFolderRow key={item.folder.id} folder={item.folder} />
        ) : (
          <FolderTreePageRow key={item.page.id} page={item.page} />
        ),
      )}

      {isFetchingNextPage ? <Skeleton className="h-9 w-full" /> : null}

      <div ref={loadMoreRef} className="h-px w-full" />
    </div>
  );
}

export function FolderNestedPagesList({
  rootFolderId = null,
}: FolderNestedPagesListProps) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-base">Contents</h2>
        <p className="text-muted-foreground text-sm">
          Includes folders and pages in this tree.
        </p>
      </div>

      <div className="rounded-md border p-2">
        <FolderTreeLevel parentFolderId={rootFolderId} />
      </div>
    </section>
  );
}
