"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { DraftActivity, type TrackedDraft } from "./draft-activity";
import { useDraftSession } from "./draft-sessions-provider";

const Context = createContext<DraftActivity | null>(null);

export function DraftActivityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [local] = useState(() => new DraftActivity());
  const activity = useDraftSession()?.activity ?? local;
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
