"use client";

import { Skeleton } from "@acme/ui/skeleton";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { FolderClosed, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { TreeMoveDialog } from "~/components/tree-move-actions";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { useMoveTreeItem } from "~/hooks/use-move-tree-item";
import {
  folderDestinationLabels,
  isValidTreeDestination,
} from "~/lib/tree-model";
import { getLibraryPagesQueryOptions } from "~/trpc/options/library-pages-query-options";
import { useTRPC } from "~/trpc/react";
import { AppSidebarTreeActions } from "../../@appSidebar/_components/app-sidebar-tree-actions";
import {
  type FolderTone,
  LibraryPageRow,
  type LibraryRowMove,
} from "./library-page-row";

/** The approved plates keep the first two folders scannable with pastels. */
const FOLDER_TONES: readonly FolderTone[] = ["mint", "peach"];
const SKELETON_ROW_KEYS = ["one", "two", "three", "four"] as const;

export function LibraryView({ tab }: { tab: "all-pages" | "folders" }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setView } = useJournlAgent();
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [moving, setMoving] = useState<LibraryRowMove | null>(null);
  const libraryFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setView({ name: "other" });
  }, [setView]);

  const commitSearch = useDebouncedCallback((value: string) => {
    setCommittedSearch(value);
  }, 150);

  const pagesQuery = useQuery({
    ...trpc.pages.getAll.queryOptions(
      getLibraryPagesQueryOptions(committedSearch),
    ),
    placeholderData: keepPreviousData,
  });
  // Folder counts come from the unfiltered list, not the visible search result.
  const allPagesQuery = useQuery(
    trpc.pages.getAll.queryOptions(getLibraryPagesQueryOptions()),
  );
  const foldersQuery = useQuery(trpc.folders.getByUser.queryOptions());

  const items = pagesQuery.data?.items ?? [];
  const folderTones = useMemo(() => {
    const tones = new Map<string, FolderTone>();
    for (const item of items) {
      const name = item.folder_name ?? "";
      if (!name || tones.has(name)) continue;
      tones.set(name, FOLDER_TONES[tones.size] ?? "neutral");
    }
    return tones;
  }, [items]);

  const { mutate: moveItem, isPending: isMovePending } = useMoveTreeItem();
  const destinations = (foldersQuery.data ?? []).flatMap((folder) =>
    folder.node_id && folder.edge_id
      ? [{ ...folder, node_id: folder.node_id }]
      : [],
  );
  const labels = folderDestinationLabels(destinations);
  const moveDestinations = [
    { label: "Library", nodeId: null },
    ...destinations
      .filter(
        (folder) =>
          !moving ||
          isValidTreeDestination(moving.node_id, folder.node_id, destinations),
      )
      .map((folder) => ({
        label: labels.get(folder.node_id) ?? folder.name,
        nodeId: folder.node_id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const directPageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of allPagesQuery.data?.items ?? []) {
      if (item.folder_id)
        counts.set(item.folder_id, (counts.get(item.folder_id) ?? 0) + 1);
    }
    return counts;
  }, [allPagesQuery.data]);

  const showSkeletons =
    (tab === "all-pages" && pagesQuery.isPending && !pagesQuery.data) ||
    (tab === "folders" && foldersQuery.isPending && !foldersQuery.data);

  return (
    <section
      ref={libraryFocusRef}
      tabIndex={-1}
      aria-label="Library content"
      className="journl-library"
      data-workspace-section
    >
      <h1 className="sr-only">{tab === "folders" ? "Folders" : "All pages"}</h1>
      <div className="journl-library-tools">
        {tab === "all-pages" ? (
          <label className="journl-library-search">
            <Search aria-hidden="true" />
            <input
              aria-label="Search by name"
              placeholder="Search by name"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                commitSearch(event.target.value);
              }}
            />
          </label>
        ) : null}
        <span className="min-w-0 flex-1" />
        <div className="journl-library-new-page">
          <AppSidebarTreeActions
            kind="root"
            parentNodeId={null}
            triggerMode="direct-page"
          />
        </div>
      </div>
      <nav className="journl-library-tabs" aria-label="Library sections">
        <Link
          href="/library"
          className="journl-library-tab"
          aria-current={tab === "all-pages" ? "page" : undefined}
        >
          All pages
        </Link>
        <Link
          href="/library?tab=folders"
          className="journl-library-tab"
          aria-current={tab === "folders" ? "page" : undefined}
        >
          Folders
        </Link>
      </nav>
      {tab === "all-pages" ? (
        <div className="journl-library-table" role="table" aria-label="Pages">
          <div
            className="journl-library-grid journl-library-grid-head"
            role="row"
          >
            <span role="columnheader">Name</span>
            <span role="columnheader">Folder</span>
            <span role="columnheader" aria-label="Actions" />
          </div>
          {showSkeletons
            ? SKELETON_ROW_KEYS.map((key) => (
                <div
                  key={`skeleton-${key}`}
                  className="journl-library-grid"
                  role="row"
                  aria-hidden="true"
                >
                  <span role="cell">
                    <Skeleton className="h-5 w-48" />
                  </span>
                  <span role="cell">
                    <Skeleton className="h-5 w-20" />
                  </span>
                  <span role="cell" />
                </div>
              ))
            : null}
          {items.map((page) => (
            <LibraryPageRow
              key={page.id}
              page={page}
              tone={folderTones.get(page.folder_name ?? "") ?? "neutral"}
              onMoveToFolder={setMoving}
            />
          ))}
          {pagesQuery.isError && !items.length ? (
            <div className="journl-library-grid" role="row">
              <span role="cell" className="journl-library-meta">
                <span role="status">
                  Couldn’t load pages. Please try again.
                </span>
              </span>
            </div>
          ) : null}
          {!showSkeletons && !pagesQuery.isError && !items.length ? (
            <div className="journl-library-grid" role="row">
              <span role="cell" className="journl-library-meta">
                <span role="status">
                  {committedSearch
                    ? `No pages match “${committedSearch}”.`
                    : "No pages yet. Create your first page."}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="journl-library-table" role="table" aria-label="Folders">
          <div
            className="journl-library-grid journl-library-grid-head"
            role="row"
          >
            <span role="columnheader">Folder</span>
            <span role="columnheader">Pages</span>
            <span role="columnheader" aria-label="Actions" />
          </div>
          {showSkeletons
            ? SKELETON_ROW_KEYS.map((key) => (
                <div
                  key={`skeleton-${key}`}
                  className="journl-library-grid"
                  role="row"
                  aria-hidden="true"
                >
                  <span role="cell">
                    <Skeleton className="h-5 w-48" />
                  </span>
                  <span role="cell">
                    <Skeleton className="h-5 w-16" />
                  </span>
                  <span role="cell" />
                </div>
              ))
            : null}
          {(foldersQuery.data ?? []).map((folder) => {
            const count = directPageCounts.get(folder.id) ?? 0;
            return (
              <div
                key={folder.id}
                className="journl-library-grid journl-library-row"
                role="row"
              >
                <div role="cell" className="journl-library-name">
                  <Link href={`/folders/${folder.id}`}>
                    <FolderClosed aria-hidden="true" />
                    <strong className="truncate">
                      {folder.name || "New folder"}
                    </strong>
                  </Link>
                </div>
                <div role="cell">
                  <span className="journl-library-meta">
                    {count === 0
                      ? "No pages"
                      : `${count} ${count === 1 ? "page" : "pages"}`}
                  </span>
                </div>
                <span role="cell" />
              </div>
            );
          })}
          {!showSkeletons &&
          !foldersQuery.isError &&
          !foldersQuery.data?.length ? (
            <div className="journl-library-grid" role="row">
              <span role="cell" className="journl-library-meta">
                <span role="status">No folders yet.</span>
              </span>
            </div>
          ) : null}
        </div>
      )}
      <TreeMoveDialog
        open={!!moving}
        onOpenChange={(open) => {
          if (!open) setMoving(null);
        }}
        finalFocus={libraryFocusRef}
        itemLabel={moving?.label ?? "page"}
        currentParentNodeId={moving?.parent_node_id ?? null}
        pending={isMovePending || foldersQuery.isPending}
        destinations={moveDestinations}
        onMove={(parentId) => {
          if (!moving) return;
          moveItem(
            {
              destination: { parent_node_id: parentId, position: "after" },
              node_id: moving.node_id,
            },
            {
              onSuccess: () => {
                setMoving(null);
                void queryClient.invalidateQueries({
                  queryKey: trpc.pages.getAll.pathKey(),
                });
              },
            },
          );
        }}
      />
    </section>
  );
}
