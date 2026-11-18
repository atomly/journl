"use client";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import {
  type QueryClient,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { FileText, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TreeMoveProvider } from "~/hooks/use-tree-item-moves";
import { useTRPC } from "~/trpc/react";
import { AppSidebarTreeActions } from "../../@appSidebar/_components/app-sidebar-tree-actions";

const ownerScopes = new WeakMap<QueryClient, symbol>();

export function LibraryFolders({ search }: { search: string }) {
  const trpc = useTRPC();
  const client = useQueryClient();
  const scope = ownerScopes.get(client) ?? Symbol("Library folder draft");
  ownerScopes.set(client, scope);
  const query = useQuery(
    trpc.folders.getByUser.queryOptions(undefined, { staleTime: 0 }),
  );
  const [editState, setEditing] = useState<{
    id: string;
    draft: string;
    scope: symbol;
  } | null>(null);
  const editing = editState?.scope === scope ? editState : null;
  const [error, setError] = useState("");
  const [folderWindow, setWindow] = useState({ limit: 20, search });
  const limit = folderWindow.search === search ? folderWindow.limit : 20;
  const folders = (query.data ?? [])
    .filter((folder) => folder.node_id && folder.edge_id)
    .filter(
      (folder) =>
        folder.id === editing?.id ||
        folder.name
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const visible = folders.slice(0, limit);
  const nodeIds = visible.flatMap((folder) =>
    folder.node_id ? [folder.node_id] : [],
  );
  const countQueries = useQueries({
    queries: Array.from(
      { length: Math.ceil(nodeIds.length / 50) },
      (_, index) =>
        trpc.folders.contentsCounts.queryOptions({
          nodeIds: nodeIds.slice(index * 50, index * 50 + 50),
        }),
    ),
  });
  const counts = countQueries.flatMap((query) => query.data ?? []);
  const countsFailed = countQueries.some((query) => query.isError);
  const countsReady = countQueries.every((query) => query.isSuccess);
  const rename = useMutation(
    trpc.folders.rename.mutationOptions({
      onError: () =>
        setError(
          "Could not rename the folder. Your name is kept; try saving again.",
        ),
      onSuccess: (_saved, variables) => {
        client.setQueryData(trpc.folders.getByUser.queryKey(), (old) =>
          old?.map((folder) =>
            folder.id === variables.id
              ? { ...folder, name: variables.name }
              : folder,
          ),
        );
        void client.invalidateQueries({
          queryKey: trpc.folders.getById.queryKey({ id: variables.id }),
        });
        void client.invalidateQueries({ queryKey: trpc.tree.pathKey() });
        setEditing(null);
        setError("");
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLInputElement>(
              '[aria-label="Find a folder by name"]',
            )
            ?.focus(),
        );
      },
    }),
  );
  const save = () => {
    if (!editing || rename.isPending) return;
    if (!editing.draft.trim()) {
      setError("Enter a folder name.");
      return;
    }
    if (
      !query.data?.some(
        (folder) =>
          folder.id === editing.id && folder.node_id && folder.edge_id,
      )
    ) {
      setError(
        "This folder is no longer available. Copy your name before leaving.",
      );
      return;
    }
    setError("");
    rename.mutate({ id: editing.id, name: editing.draft });
  };
  // Successful tree actions can change this independent projection while its rows unmount.
  useEffect(
    () =>
      client.getMutationCache().subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "success") return;
        if (
          /"(?:tree|folders)"/.test(
            JSON.stringify(event.mutation.options.mutationKey ?? []),
          )
        ) {
          void client.invalidateQueries(trpc.folders.getByUser.queryFilter());
          void client.invalidateQueries(
            trpc.folders.contentsCounts.queryFilter(),
          );
        }
      }),
    [client, trpc],
  );
  return (
    <TreeMoveProvider>
      <div className="library-columns" aria-hidden>
        <span>FOLDER</span>
        <span>CONTENTS</span>
        <span>ACTIONS</span>
      </div>
      {query.isPending ? (
        <p role="status">Loading folders…</p>
      ) : query.isError ? (
        <div role="alert">
          <p>Could not load folders.</p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      ) : !folders.length ? (
        <div className="py-12">
          <h2 className="font-semibold text-2xl">
            {search ? "No folders found" : "Give your pages a home"}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {search
              ? "Try another folder name."
              : "Create a folder to organize your knowledge."}
          </p>
        </div>
      ) : (
        <ul>
          {visible.map((folder) => {
            const contents = counts.find(
              (row) => row.node_id === folder.node_id,
            );
            const metadata = contents
              ? [
                  contents.pages
                    ? `${contents.pages} ${contents.pages === 1 ? "page" : "pages"}`
                    : "",
                  contents.folders
                    ? `${contents.folders} ${contents.folders === 1 ? "folder" : "folders"}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "Empty folder"
              : countsFailed || countsReady
                ? "Contents unavailable"
                : "Loading contents…";
            return (
              <li key={folder.id} className="library-folder-row">
                <div className="flex min-w-0 items-center gap-2">
                  {editing?.id === folder.id ? (
                    <div className="w-full">
                      <Input
                        aria-label={`Rename ${folder.name}`}
                        value={editing.draft}
                        maxLength={500}
                        disabled={rename.isPending}
                        onChange={(event) =>
                          setEditing({
                            draft: event.target.value,
                            id: folder.id,
                            scope,
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") save();
                          if (event.key === "Escape" && !rename.isPending) {
                            setEditing(null);
                            setError("");
                          }
                        }}
                      />
                      <div className="mt-2 flex gap-2">
                        <Button disabled={rename.isPending} onClick={save}>
                          {rename.isPending ? "Saving name…" : "Save name"}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={rename.isPending}
                          onClick={() => {
                            setEditing(null);
                            setError("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Link
                        className="library-page-name flex-1"
                        href={`/folders/${folder.id}`}
                      >
                        <FileText aria-hidden />
                        <span>
                          {folder.name}
                          <small>{metadata}</small>
                        </span>
                      </Link>
                      <Button
                        className="library-row-action"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Rename ${folder.name}`}
                        disabled={Boolean(editing) || rename.isPending}
                        onClick={() => {
                          setError("");
                          setEditing({
                            draft: folder.name,
                            id: folder.id,
                            scope,
                          });
                        }}
                      >
                        <Pencil />
                      </Button>
                    </>
                  )}
                </div>
                <span className="library-folder">{metadata}</span>
                <AppSidebarTreeActions
                  folder={folder}
                  kind="folder"
                  parentNodeId={folder.node_id}
                  triggerVariant="inline"
                  className="library-row-action"
                />
              </li>
            );
          })}
        </ul>
      )}
      {editing &&
        query.data &&
        !query.data.some(
          (folder) => folder.id === editing.id && folder.edge_id,
        ) && (
          <div role="alert" className="mt-4">
            <p>
              This folder is no longer available. Your entered name is kept
              here.
            </p>
            <Input
              aria-label="Retained folder name"
              readOnly
              value={editing.draft}
            />
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setError("");
              }}
            >
              Discard retained name
            </Button>
          </div>
        )}
      {countsFailed && (
        <Button
          variant="outline"
          onClick={() => {
            for (const query of countQueries) void query.refetch();
          }}
        >
          Retry contents
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-4 text-destructive">
          {error}
        </p>
      )}
      <p className="mt-6 text-muted-foreground text-sm">
        {folders.length} folders
      </p>
      {folders.length > limit && (
        <Button
          variant="outline"
          onClick={() => setWindow({ limit: limit + 20, search })}
        >
          Load more folders
        </Button>
      )}
    </TreeMoveProvider>
  );
}
