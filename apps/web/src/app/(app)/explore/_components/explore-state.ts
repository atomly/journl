"use client";
import { useEffect, useState } from "react";

/** Route-scoped restoration survives navigation, without sharing user data between sessions. */
export function useExploreState<T>(key: string, initial: T) {
  const [state, setState] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`journl:explore:${key}`);
      if (saved)
        setState(
          JSON.parse(saved, (_key, value) =>
            value === null ? undefined : value,
          ),
        );
    } catch {
      /* Storage may be unavailable. */
    }
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (loaded) {
      try {
        sessionStorage.setItem(`journl:explore:${key}`, JSON.stringify(state));
      } catch {
        /* Navigation remains usable without persistence. */
      }
    }
  }, [key, state, loaded]);
  return [state, setState] as const;
}
