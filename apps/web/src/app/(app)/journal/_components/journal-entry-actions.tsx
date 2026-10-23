"use client";

import { Button } from "@acme/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@acme/ui/tooltip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileOutput } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { folderDestinationLabel } from "~/lib/tree-model";
import { useTRPC } from "~/trpc/react";
import { useJournalDraftActions } from "./journal-drafts-provider";

export function JournalEntryActions({
  date,
  title,
  documentId,
  updatedAt,
}: {
  date: string;
  title: string;
  documentId: string;
  updatedAt: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(title);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [parentNodeId, setParentNodeId] = useState<string | null>(null);
  const drafts = useJournalDraftActions();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const folders = useQuery({
    ...trpc.folders.getByUser.queryOptions(),
    enabled: open,
  });
  const router = useRouter();
  const move = useMutation(trpc.journal.moveToPage.mutationOptions());
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move entry to page"
              onClick={() => {
                setError("");
                setOpen(true);
              }}
            >
              <FileOutput />
            </Button>
          }
        />
        <TooltipContent>Move to page</TooltipContent>
      </Tooltip>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move entry to a page</DialogTitle>
            <DialogDescription>
              The writing moves to Library. This journal entry keeps a reference
              to the new page.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                const draft = drafts.get(date);
                await draft?.flush();
                if (draft?.hasUnsavedChanges())
                  throw new Error(
                    "Resolve the unsaved changes before moving this entry.",
                  );
                const saved = draft?.getSnapshot();
                const result = await move.mutateAsync({
                  date,
                  documentId: saved?.documentId ?? documentId,
                  expectedUpdatedAt: saved?.updatedAt ?? updatedAt,
                  parentNodeId,
                  title: name,
                });
                drafts.forget(date);
                queryClient.setQueryData(
                  trpc.journal.getByDate.queryKey({ date }),
                  result.entry,
                );
                await Promise.all(
                  [
                    trpc.journal.getEntries.infiniteQueryKey(),
                    trpc.journal.getTimeline.infiniteQueryKey(),
                    trpc.tree.getChildrenPaginated.infiniteQueryKey(),
                    trpc.pages.getByUser.queryKey(),
                    trpc.folders.getByUser.queryKey(),
                    trpc.references.getPreviews.queryKey(),
                    trpc.references.getEmbedContent.queryKey(),
                    trpc.references.listBacklinks.queryKey(),
                    trpc.references.getGraph.infiniteQueryKey(),
                  ].map((queryKey) =>
                    queryClient.invalidateQueries({ queryKey }),
                  ),
                );
                router.push(`/pages/${result.page.id}`);
                router.refresh();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Unable to move this entry. Your writing has been kept.",
                );
                setBusy(false);
              }
            }}
          >
            <label className="flex flex-col gap-2 text-sm">
              Page title
              <input
                autoFocus
                required
                maxLength={255}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={busy}
                className="rounded-md border bg-background px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Destination
              <select
                aria-label="Destination"
                value={parentNodeId ?? ""}
                disabled={busy || folders.isPending}
                onChange={(event) =>
                  setParentNodeId(event.target.value || null)
                }
                className="rounded-md border bg-background px-3 py-2"
              >
                <option value="">Library</option>
                {(folders.data ?? [])
                  .filter((folder) => folder.node_id && folder.edge_id)
                  .map((folder) => (
                    <option key={folder.node_id} value={folder.node_id ?? ""}>
                      {folderDestinationLabel(
                        folder.node_id ?? "",
                        folders.data ?? [],
                      )}
                    </option>
                  ))}
              </select>
            </label>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? "Moving…" : "Move to page"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
