"use client";
import { EditorContent } from "@acme/better-editor/ui/editor-content";
import { Button } from "@acme/ui/button";
import { Spinner } from "@acme/ui/spinner";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { DocumentEditSession } from "~/ai/client/document-edit-session";

export function DocumentWritingStatus({
  session,
}: {
  session: DocumentEditSession;
}) {
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  if (snapshot.requested && ["applied", "cancelled"].includes(snapshot.status))
    return (
      <span role="status" className="sr-only">
        {snapshot.status === "applied"
          ? "Writing complete."
          : "Writing stopped. Your original writing was kept."}
      </span>
    );
  if (!snapshot.requested || ["idle", "prepared"].includes(snapshot.status))
    return null;
  const surface = session.draftSurface;
  return (
    <>
      {surface &&
        createPortal(
          <EditorContent editor={surface.editor} />,
          surface.element,
        )}
      <section
        className="sticky bottom-3 mx-12 my-2 flex w-fit max-w-full items-center gap-2 text-muted-foreground text-xs"
        aria-label="AI writing"
        data-ai-edit-status={snapshot.status}
      >
        {snapshot.status === "generating" && (
          <Spinner aria-hidden="true" className="size-3" />
        )}
        <span role="status" title={snapshot.message}>
          {snapshot.status === "generating"
            ? "Writing…"
            : "Couldn’t finish writing. Check your page and selection, then retry in chat."}
          <span className="sr-only"> {snapshot.message}</span>
        </span>
        {snapshot.status === "generating" && !snapshot.following && (
          <Button variant="ghost" size="xs" onClick={session.followWriting}>
            Follow writing
          </Button>
        )}
        {snapshot.status === "generating" && (
          <Button
            aria-label="Stop AI writing"
            variant="ghost"
            size="xs"
            onClick={session.cancel}
          >
            Stop
          </Button>
        )}
      </section>
    </>
  );
}
