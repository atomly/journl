"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "~/components/ui/button";
import type { TrackedDraft } from "./draft-activity-provider";

type Draft = TrackedDraft["draft"];
type RecoveryCopy = ReturnType<Draft["getSnapshot"]>["recoveryCopies"][number];

export function downloadRichDraft(
  value: Pick<RecoveryCopy, "blocks" | "title">,
  filename: string,
) {
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          { format: "journl-draft", version: 1, ...value },
          null,
          2,
        ),
      ],
      {
        type: "application/json",
      },
    ),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DraftRecoveryActions({
  draft,
  filename,
  showTabNotice = true,
  isOffline = false,
}: {
  draft: Draft;
  filename: string;
  showTabNotice?: boolean;
  isOffline?: boolean;
}) {
  const snapshot = useSyncExternalStore(
    draft.subscribe,
    draft.getSnapshot,
    draft.getSnapshot,
  );
  const [downloadError, setDownloadError] = useState(false);
  const download = () => {
    try {
      downloadRichDraft(
        { blocks: snapshot.blocks, title: snapshot.title },
        `${filename}.json`,
      );
      setDownloadError(false);
    } catch {
      setDownloadError(true);
    }
  };
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-sm">
        {snapshot.conflict
          ? "A newer version was saved elsewhere."
          : isOffline
            ? "Changes will sync when connected."
            : "Your latest changes haven’t been saved."}
      </p>
      {snapshot.error instanceof Error &&
        snapshot.error.message.startsWith("This page was deleted") && (
          <p className="text-sm">
            This page was deleted. Download your draft to keep it.
          </p>
        )}
      {snapshot.error instanceof Error &&
        snapshot.error.message.startsWith("Your draft changed") && (
          <p className="text-sm">
            Your writing changed while loading. It is still here. Finish
            editing, then choose Keep both again.
          </p>
        )}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap">
        {!snapshot.conflict && !isOffline && (
          <Button
            size="sm"
            disabled={snapshot.isSaving}
            onClick={() => void draft.retry()}
          >
            {snapshot.isSaving ? "Retrying…" : "Retry save"}
          </Button>
        )}
        {snapshot.conflict && (
          <Button
            size="sm"
            disabled={snapshot.isSaving || isOffline}
            onClick={() => void draft.loadSaved()}
          >
            Keep both and load saved
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={download}>
          Download full draft
        </Button>
      </div>
      {snapshot.conflict && (
        <p className="text-muted-foreground text-xs">
          Keeps your draft here and opens the saved version.
        </p>
      )}
      {showTabNotice && (
        <p className="text-muted-foreground text-xs">
          Your draft stays in this tab. Download before refreshing or closing.
        </p>
      )}
      {downloadError && (
        <p role="alert" className="text-sm">
          The download couldn’t start. Your draft is still here; please try
          again.
        </p>
      )}
    </div>
  );
}
