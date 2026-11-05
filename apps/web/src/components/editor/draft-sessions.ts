import type { JournalEntryDraft } from "~/app/(app)/journal/_components/journal-entry-draft";
import { DraftActivity } from "./draft-activity";
import type { PageDraft } from "./page-drafts-provider";

export type DraftSession = {
  owner: string;
  pages: Map<string, PageDraft>;
  journals: Map<string, JournalEntryDraft>;
  activity: DraftActivity;
};

/** Tab memory owned above layouts. A different authenticated owner starts fresh. */
export class DraftSessions {
  private sessions = new Map<string, DraftSession>();
  private active: DraftSession | null = null;
  private listeners = new Set<() => void>();
  get(owner: string) {
    let session = this.sessions.get(owner);
    if (!session) {
      session = {
        activity: new DraftActivity(),
        journals: new Map(),
        owner,
        pages: new Map(),
      };
      this.sessions.set(owner, session);
    }
    return session;
  }
  activate(owner: string) {
    const session = this.get(owner);
    if (this.active === session) return;
    for (const key of this.sessions.keys())
      if (key !== owner) this.sessions.delete(key);
    this.active = session;
    for (const listener of this.listeners) listener();
  }
  getSnapshot = () => this.active;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  hasUnsavedChanges = () =>
    Boolean(
      this.active?.activity.getSnapshot().some(({ draft }) => {
        const snapshot = draft.getSnapshot();
        return snapshot.isDirty || snapshot.recoveryCopies.length;
      }),
    );
  resume = () => {
    for (const { draft } of this.active?.activity.getSnapshot() ?? []) {
      const snapshot = draft.getSnapshot();
      if (snapshot.error && !snapshot.conflict && !snapshot.isSaving)
        void draft.retry();
    }
  };
}
