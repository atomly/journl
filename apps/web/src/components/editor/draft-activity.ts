import type { DocumentDraft } from "./document-draft";
export type TrackedDraft = {
  key: string;
  label: string;
  href: string;
  draft: Pick<
    DocumentDraft<{ document_id: string; updated_at: string }>,
    "getSnapshot" | "subscribe" | "retry" | "loadSaved" | "discardRecoveryCopy"
  >;
};

/** One subscription per edited document, independent of editor/route mounts. */
export class DraftActivity {
  private entries = new Map<string, TrackedDraft>();
  private subscriptions = new Map<string, () => void>();
  private listeners = new Set<() => void>();
  private snapshot: TrackedDraft[] = [];

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish = () => {
    this.snapshot = [...this.entries.values()];
    for (const listener of this.listeners) listener();
  };
  register = (entry: TrackedDraft) => {
    if (this.entries.get(entry.key)?.draft === entry.draft) return;
    this.subscriptions.get(entry.key)?.();
    this.entries.set(entry.key, entry);
    this.subscriptions.set(entry.key, entry.draft.subscribe(this.publish));
    this.publish();
  };
}
