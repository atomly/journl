"use client";
import { toTiptapDocument } from "@acme/better-editor/serialization/tiptap";
import { Button } from "@acme/ui/button";
import { DOMSerializer } from "@tiptap/pm/model";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { DocumentEditSession } from "~/ai/client/document-edit-session";

export function DocumentEditPreview({
  session,
}: {
  session: DocumentEditSession;
}) {
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const host = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!host.current) return;
    try {
      const doc = toTiptapDocument(
        snapshot.blocks,
        session.editor.state.schema,
      );
      host.current.replaceChildren(
        DOMSerializer.fromSchema(doc.type.schema).serializeFragment(
          doc.content,
        ),
      );
    } catch {
      host.current.replaceChildren();
    }
  }, [snapshot.blocks, session]);
  if (!snapshot.requested || ["idle", "prepared"].includes(snapshot.status))
    return null;
  return (
    <section
      className="mx-6 my-3 rounded-lg border border-sidebar-border bg-muted/30 p-3"
      aria-label="AI edit"
      data-ai-edit-status={snapshot.status}
    >
      <p role="status" className="text-muted-foreground text-sm">
        {snapshot.message}
      </p>
      {snapshot.status === "generating" && (
        <section
          ref={host}
          className="journl-ai-preview mt-3"
          aria-label="AI preview"
        />
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
    </section>
  );
}
