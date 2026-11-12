"use client";
import { EditorContent } from "@acme/better-editor/ui/editor-content";
import { Button } from "@acme/ui/button";
import { Separator } from "@acme/ui/separator";
import { LocateFixed, LocateOff, Square } from "lucide-react";
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
  if (
    snapshot.requested &&
    ["applied", "unchanged", "cancelled"].includes(snapshot.status)
  )
    return (
      <span role="status" className="sr-only">
        {snapshot.status === "applied"
          ? "Writing complete."
          : snapshot.status === "unchanged"
            ? "No changes were made."
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
          className="journl-ai-writing-badge pointer-events-auto relative flex w-fit max-w-full -translate-y-full items-center gap-1.5 rounded-lg border border-sidebar-border bg-popover p-1.5 text-popover-foreground text-xs shadow-md"
          aria-label="AI writing"
          data-ai-edit-status={snapshot.status}
        >
          <span
            role="status"
            title={snapshot.message}
            className="px-1.5 leading-6"
          >
            {snapshot.status === "generating"
              ? snapshot.phase === "correcting"
                ? "Revising…"
                : snapshot.phase === "checking"
                  ? "Checking…"
                  : snapshot.phase === "preparing"
                    ? "Preparing…"
                    : "Writing…"
              : snapshot.message || "Couldn’t finish writing. Retry in chat."}
            {snapshot.status === "generating" && (
              <span className="sr-only"> {snapshot.message}</span>
            )}
          </span>
          {snapshot.status === "generating" && (
            <Separator orientation="vertical" className="my-1" />
          )}
          {snapshot.status === "generating" && (
            <Button
              aria-label="Follow writing"
              aria-pressed={snapshot.following}
              title={
                snapshot.following
                  ? "Pause following edits"
                  : "Follow the current edit"
              }
              variant={snapshot.following ? "outline" : "ghost"}
              size="xs"
              onClick={session.toggleFollowing}
            >
              {snapshot.following ? (
                <LocateFixed data-icon="inline-start" />
              ) : (
                <LocateOff data-icon="inline-start" />
              )}
              Follow
            </Button>
          )}
          {snapshot.status === "generating" && (
            <Button
              aria-label="Stop AI writing"
              variant="ghost"
              size="xs"
              onClick={session.cancel}
            >
              <Square data-icon="inline-start" />
              Stop
            </Button>
          )}
        </section>
      </div>
    </>
  );
}
