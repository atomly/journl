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
      <div className="pointer-events-none sticky bottom-3 z-50 mx-6 h-0 max-w-[calc(100%-3rem)] self-start">
        <section
          className="pointer-events-auto flex w-fit max-w-full -translate-y-full items-center gap-2 rounded-lg border border-sidebar-border bg-popover px-3 py-1.5 text-popover-foreground text-xs shadow-md"
          aria-label="AI writing"
          data-ai-edit-status={snapshot.status}
        >
          {snapshot.status === "generating" && (
            <Spinner aria-hidden="true" className="size-3" />
          )}
          <span role="status" title={snapshot.message}>
            {snapshot.status === "generating"
              ? snapshot.phase === "correcting"
                ? "Revising…"
                : snapshot.phase === "preparing"
                  ? "Preparing edit…"
                  : "Writing…"
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
      </div>
    </>
  );
}
