"use client";

import {
  AlertCircleIcon,
  CloudCheckIcon,
  CloudOffIcon,
  LoaderCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { DraftRecoveryCopy } from "./document-draft";
import { useTrackedDrafts } from "./draft-activity-provider";
import {
  DraftRecoveryActions,
  downloadRichDraft,
} from "./draft-recovery-actions";

import { useVisibleViewportInset } from "./use-visible-viewport-inset";

const KeptDraftPreview = lazy(() => import("./kept-draft-preview"));

function KeptCopy({
  copy,
  filename,
  remove,
}: {
  copy: DraftRecoveryCopy;
  filename: string;
  remove: () => void;
}) {
  const [view, setView] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  return (
    <div className="min-w-0 space-y-2 rounded-md border p-3">
      <p className="break-words font-medium">
        Kept draft{copy.title ? ` · ${copy.title}` : ""}
      </p>
      <p className="text-muted-foreground text-xs">
        Kept {new Date(copy.createdAt).toLocaleString()}
      </p>
      <p className="text-muted-foreground text-xs">
        Your original draft, with formatting and references.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          size="sm"
          variant="outline"
          aria-expanded={view}
          onClick={() => setView(!view)}
        >
          {view ? "Hide kept draft" : "View kept draft"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            try {
              downloadRichDraft(copy, `${filename}-${copy.id}.json`);
              setDownloadError(false);
            } catch {
              setDownloadError(true);
            }
          }}
        >
          Download kept draft
        </Button>
      </div>
      {confirmRemoval ? (
        <div className="space-y-2 rounded-md border p-2">
          <p>Remove this copy? This can’t be undone.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmRemoval(false)}
            >
              Keep draft
            </Button>
            <Button size="sm" variant="destructive" onClick={remove}>
              Remove copy
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmRemoval(true)}
        >
          Remove kept draft
        </Button>
      )}
      {downloadError && (
        <p role="alert">
          The download couldn’t start. Your kept draft is still here.
        </p>
      )}
      {view && (
        <Suspense fallback={<p role="status">Opening kept draft…</p>}>
          <KeptDraftPreview copy={copy} />
        </Suspense>
      )}
    </div>
  );
}

/** Quiet header status; failures stay visible in a separate persistent notice. */
export function SaveStatus() {
  const entries = useTrackedDrafts();
  const viewportInset = useVisibleViewportInset();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setMounted(true);
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  const errors = entries.filter(({ draft }) =>
    Boolean(draft.getSnapshot().error),
  );
  const saving = entries.some(({ draft }) => draft.getSnapshot().isDirty);
  const offlinePending = !online && saving;
  const copies = entries.reduce(
    (count, { draft }) => count + draft.getSnapshot().recoveryCopies.length,
    0,
  );
  const status = !online
    ? "Offline"
    : errors.length
      ? errors.length === 1
        ? "Couldn’t save"
        : `${errors.length} drafts couldn’t save`
      : saving
        ? "Saving…"
        : copies
          ? `${copies} kept ${copies === 1 ? "draft" : "drafts"} in this tab`
          : entries.length
            ? "Saved"
            : "Autosave on";
  const visibleEntries = entries.filter(({ draft }) => {
    const snapshot = draft.getSnapshot();
    return snapshot.error || snapshot.isDirty || snapshot.recoveryCopies.length;
  });

  return (
    <div data-save-status className="inline-flex items-center">
      <span
        role="status"
        aria-live={errors.length || offlinePending ? "off" : "polite"}
        aria-atomic="true"
        className="sr-only"
      >
        {status}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Save details"
              title={status}
            />
          }
        >
          {!online ? (
            <CloudOffIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          ) : errors.length ? (
            <AlertCircleIcon
              aria-hidden="true"
              className="size-4 text-destructive"
            />
          ) : saving ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <CloudCheckIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          )}
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-y-auto sm:max-w-xl">
          <DialogHeader className="pr-8">
            <DialogTitle>Draft recovery</DialogTitle>
            <DialogDescription>
              Drafts stay in this tab. Download before refreshing or closing.
            </DialogDescription>
          </DialogHeader>
          {!visibleEntries.length && (
            <p>
              {saving
                ? "Your changes are being saved."
                : "All changes are saved."}
            </p>
          )}
          {visibleEntries.map(({ key, label, href, draft }) => {
            const snapshot = draft.getSnapshot();
            return (
              <section
                key={key}
                className="min-w-0 space-y-3 rounded-lg border p-3"
                aria-label={snapshot.title || label}
              >
                <h3 className="break-words font-medium">
                  {snapshot.title || label}
                </h3>
                <Link
                  className="inline-block underline underline-offset-4"
                  href={href}
                  onClick={() => setOpen(false)}
                >
                  Open document
                </Link>
                {snapshot.error || (!online && snapshot.isDirty) ? (
                  <DraftRecoveryActions
                    draft={draft}
                    isOffline={!online}
                    showTabNotice={false}
                    filename={`${key.replaceAll(":", "-")}-draft`}
                  />
                ) : snapshot.isDirty ? (
                  <p>Saving…</p>
                ) : (
                  <p>The current version is saved.</p>
                )}
                {snapshot.recoveryCopies.map((copy) => (
                  <KeptCopy
                    key={copy.id}
                    copy={copy}
                    filename={`${key.replaceAll(":", "-")}-draft`}
                    remove={() => draft.discardRecoveryCopy(copy.id)}
                  />
                ))}
              </section>
            );
          })}
          {visibleEntries.length > 0 && (
            <details className="text-muted-foreground text-xs">
              <summary className="cursor-pointer">About downloads</summary>
              <p className="mt-1">
                JSON backups include formatting and references. Importing
                backups isn’t supported yet.
              </p>
            </details>
          )}
        </DialogContent>
      </Dialog>
      {mounted &&
        (errors.length > 0 || copies > 0 || offlinePending) &&
        createPortal(
          <div
            data-save-notice
            className="fixed left-1/2 z-4500 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border bg-popover px-3 py-2 text-popover-foreground shadow-lg"
            style={{
              bottom: `calc(5rem + env(safe-area-inset-bottom, 0px) + ${viewportInset}px)`,
            }}
          >
            <p
              role={errors.length || offlinePending ? "alert" : "status"}
              aria-atomic="true"
              className="min-w-0 flex-1 text-sm"
            >
              {offlinePending
                ? "Offline · Changes kept in this tab"
                : errors.length
                  ? errors.length === 1
                    ? "Changes aren’t saved"
                    : `${errors.length} drafts aren’t saved`
                  : "Draft kept in this tab"}
            </p>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              Review drafts
            </Button>
          </div>,
          document.body,
        )}
    </div>
  );
}
