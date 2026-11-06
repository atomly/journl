"use client";
import { EditorContent } from "@acme/better-editor/ui/editor-content";
import { Alert, AlertDescription } from "@acme/ui/alert";
import { Button } from "@acme/ui/button";
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
      <Alert
        role="region"
        className="sticky bottom-3 z-10 mx-6 my-3 w-auto"
        aria-label="AI edit"
        data-ai-edit-status={snapshot.status}
      >
        <AlertDescription role="status">{snapshot.message}</AlertDescription>
        {snapshot.status === "generating" && !snapshot.following && (
          <Button variant="outline" size="sm" onClick={session.followWriting}>
            Follow writing
          </Button>
        )}
        {snapshot.status === "generating" && (
          <Button variant="outline" size="sm" onClick={session.cancel}>
            Cancel AI edit
          </Button>
        )}
        {snapshot.canRetry &&
          ["conflict", "error", "cancelled"].includes(snapshot.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void session.retry()}
            >
              Retry AI edit
            </Button>
          )}
      </Alert>
    </>
  );
}
