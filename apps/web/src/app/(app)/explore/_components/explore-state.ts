"use client";
import type { Dispatch, SetStateAction } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

export const ExploreOwnerContext = createContext<string | undefined>(undefined);

/** Owner- and route-scoped state. Never expose a previous owner's state during hydration. */
export function useExploreState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const owner = useContext(ExploreOwnerContext);
  const storageKey = owner ? `journl:explore:${owner}:${key}` : undefined;
  const initialRef = useRef(initial);
  const [record, setRecord] = useState({ key: storageKey, value: initial });
  const [loadedKey, setLoadedKey] = useState<string>();
  useEffect(() => {
    let value = initialRef.current;
    try {
      const saved = storageKey && sessionStorage.getItem(storageKey);
      if (saved)
        value = JSON.parse(saved, (_key, item) =>
          item === null ? undefined : item,
        );
    } catch {
      /* Storage may be unavailable or obsolete. */
    }
    setRecord({ key: storageKey, value });
    setLoadedKey(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (storageKey && loadedKey === storageKey && record.key === storageKey) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(record.value));
      } catch {
        /* Navigation remains usable without persistence. */
      }
    }
  }, [storageKey, loadedKey, record]);
  const value = record.key === storageKey ? record.value : initialRef.current;
  const setValue: Dispatch<SetStateAction<T>> = (update) =>
    setRecord((previous) => ({
      key: storageKey,
      value:
        typeof update === "function"
          ? (update as (state: T) => T)(
              previous.key === storageKey ? previous.value : initialRef.current,
            )
          : update,
    }));
  // The setter must remain stable for consumers' effects.
  const setterRef = useRef(setValue);
  setterRef.current = setValue;
  const [setter] = useState(
    () => (update: SetStateAction<T>) => setterRef.current(update),
  );
  return [value, setter];
}
