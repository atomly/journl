"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const MAX_SAVED_FOLDERS = 128;
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
type Saved = Record<string, number>;
const storageKey = (owner: string) => `journl:sidebar-expansion:v1:${owner}`;

/** Expired/deleted IDs never cause requests: only rendered folder rows can load children. */
export function readSidebarExpansion(
  value: string | null,
  now = Date.now(),
): Saved {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(
          ([id, time]) =>
            id.length <= 128 &&
            typeof time === "number" &&
            time > now - MAX_AGE &&
            time <= now,
        )
        .sort(([, a], [, b]) => Number(b) - Number(a))
        .slice(0, MAX_SAVED_FOLDERS),
    );
  } catch {
    return {};
  }
}

/** Saved opens < active ancestors < manual choices for the current navigation target. */
export function useSidebarExpansion(
  owner: string | undefined,
  target: string,
  ancestors: string[],
) {
  const [saved, setSaved] = useState<{ owner?: string; folders: Saved }>({
    folders: {},
  });
  const [manual, setManual] = useState<{
    owner?: string;
    target: string;
    folders: Record<string, boolean>;
  }>({ folders: {}, owner, target });
  useEffect(() => {
    let folders: Saved = {};
    try {
      if (owner)
        folders = readSidebarExpansion(localStorage.getItem(storageKey(owner)));
    } catch {
      /* Storage can be disabled. Expansion still works in memory. */
    }
    setSaved({ folders, owner });
  }, [owner]);
  useEffect(() => {
    setManual({ folders: {}, owner, target });
  }, [owner, target]);
  const openFolders = useMemo(
    () => ({
      ...Object.fromEntries(
        Object.keys(saved.owner === owner ? saved.folders : {}).map((id) => [
          id,
          true,
        ]),
      ),
      ...Object.fromEntries(ancestors.map((id) => [id, true])),
      ...(manual.owner === owner && manual.target === target
        ? manual.folders
        : {}),
    }),
    [ancestors, manual, owner, saved, target],
  );
  const setFolderOpen = useCallback(
    (id: string, open: boolean) => {
      setManual((previous) => ({
        folders: {
          ...(previous.owner === owner && previous.target === target
            ? previous.folders
            : {}),
          [id]: open,
        },
        owner,
        target,
      }));
      setSaved((previous) => {
        const folders = {
          ...(previous.owner === owner ? previous.folders : {}),
        };
        if (open) folders[id] = Date.now();
        else delete folders[id];
        const bounded = readSidebarExpansion(JSON.stringify(folders));
        try {
          if (owner)
            localStorage.setItem(storageKey(owner), JSON.stringify(bounded));
        } catch {
          /* Keep memory state if storage is unavailable. */
        }
        return { folders: bounded, owner };
      });
    },
    [owner, target],
  );
  return { openFolders, setFolderOpen };
}
