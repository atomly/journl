"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
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

const Context = createContext<DraftActivity | null>(null);

export function DraftActivityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activity] = useState(() => new DraftActivity());
  useEffect(() => {
    const resume = () => {
      for (const { draft } of activity.getSnapshot()) {
        const snapshot = draft.getSnapshot();
        if (snapshot.error && !snapshot.conflict) void draft.retry();
      }
    };
    window.addEventListener("online", resume);
    return () => window.removeEventListener("online", resume);
  }, [activity]);
  return <Context.Provider value={activity}>{children}</Context.Provider>;
}

export const useDraftActivity = () => useContext(Context);
const empty: TrackedDraft[] = [];
const getEmpty = () => empty;
const subscribeEmpty = () => () => {};

export function useTrackedDrafts() {
  const activity = useDraftActivity();
  return useSyncExternalStore(
    activity?.subscribe ?? subscribeEmpty,
    activity?.getSnapshot ?? getEmpty,
    getEmpty,
  );
}
