"use client";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@acme/ui/tabs";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TreeMoveProvider } from "~/hooks/use-tree-item-moves";
import { useTRPC } from "~/trpc/react";
import { AppSidebarTreeActions } from "../../@appSidebar/_components/app-sidebar-tree-actions";
import { FolderNestedPagesList } from "../../folders/_components/folder-nested-pages-list";
import { LibraryPageActions } from "./library-page-actions";

export function Library() {
  const trpc = useTRPC();
  const client = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 200);
    return () => clearTimeout(timer);
  }, [search]);
  const result = useInfiniteQuery(
    trpc.pages.list.infiniteQueryOptions(
      { limit: 20, search: query },
      { getNextPageParam: (last) => last.nextCursor },
    ),
  );
  // Existing tree mutations also affect this independent, alphabetic Library projection.
  useEffect(
    () =>
      client.getMutationCache().subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "success") return;
        const key = JSON.stringify(event.mutation.options.mutationKey ?? []);
        if (/"(?:tree|pages|folders)"/.test(key))
          void client.invalidateQueries(trpc.pages.list.infiniteQueryFilter());
      }),
    [client, trpc],
  );
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="journl-library">
      <p className="route-eyebrow">YOUR KNOWLEDGE, TOGETHER</p>
      <div className="route-heading">
        <h1>All pages</h1>
        <AppSidebarTreeActions
          kind="root"
          parentNodeId={null}
          triggerMode="direct-page"
          className="w-auto"
        />
      </div>
      <Tabs defaultValue="pages">
        <div className="library-toolbar">
          <TabsList variant="line">
            <TabsTrigger value="pages">All pages</TabsTrigger>
            <TabsTrigger value="folders">Folders</TabsTrigger>
          </TabsList>
          <Input
            disabled={!ready}
            maxLength={500}
            aria-label="Find a page by name"
            placeholder="Find a page by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-80"
          />
        </div>
        <TabsContent value="pages">
          <TreeMoveProvider>
            <div className="library-columns" aria-hidden>
              <span>PAGE</span>
              <span>FOLDER</span>
              <span>ACTIONS</span>
            </div>
            {result.isPending ? (
              <p role="status">Loading pages…</p>
            ) : result.isError ? (
              <div role="alert">
                <p>Could not load your pages.</p>
                <Button variant="outline" onClick={() => result.refetch()}>
                  Retry
                </Button>
              </div>
            ) : !items.length ? (
              <div className="py-12">
                <h2 className="font-semibold text-2xl">
                  {query ? "No pages found" : "A home for your knowledge"}
                </h2>
                <p className="mt-3 text-muted-foreground">
                  {query
                    ? "Try another page name."
                    : "Create a page or organize your pages in folders."}
                </p>
              </div>
            ) : (
              <ul>
                {items.map((page) => (
                  <li key={page.id} className="library-page-row">
                    <Link
                      className="library-page-name"
                      href={`/pages/${page.id}`}
                    >
                      <FileText aria-hidden />
                      <span>
                        {page.title || "New page"}
                        <small>{page.folder_name || "Library"}</small>
                      </span>
                    </Link>
                    {page.folder_id ? (
                      <Link
                        className="library-folder"
                        href={`/folders/${page.folder_id}`}
                      >
                        {page.folder_name}
                      </Link>
                    ) : (
                      <span className="library-folder">Library</span>
                    )}
                    <LibraryPageActions page={page} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-6 text-muted-foreground text-sm">
              {items.length} pages · Search matches page names
            </p>
            {result.hasNextPage && (
              <Button
                disabled={result.isFetchingNextPage}
                variant="outline"
                onClick={() => result.fetchNextPage()}
              >
                {result.isFetchingNextPage
                  ? "Loading pages…"
                  : "Load more pages"}
              </Button>
            )}
          </TreeMoveProvider>
        </TabsContent>
        <TabsContent value="folders">
          <FolderNestedPagesList />
        </TabsContent>
      </Tabs>
    </section>
  );
}
