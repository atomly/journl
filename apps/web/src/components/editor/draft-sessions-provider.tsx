"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { type DraftSession, DraftSessions } from "./draft-sessions";

const RegistryContext = createContext<DraftSessions | null>(null);
const OwnerContext = createContext<DraftSession | null>(null);
const empty = () => null;
const subscribeEmpty = () => () => {};

export function DraftSessionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [registry] = useState(() => new DraftSessions());
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (registry.hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("online", registry.resume);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("online", registry.resume);
    };
  }, [registry]);
  return (
    <RegistryContext.Provider value={registry}>
      {children}
    </RegistryContext.Provider>
  );
}

export function DraftOwnerProvider({
  owner,
  children,
}: {
  owner: string;
  children: React.ReactNode;
}) {
  const shared = useContext(RegistryContext);
  const [fallback] = useState(() => new DraftSessions());
  const registry = shared ?? fallback;
  const session = useMemo(() => registry.get(owner), [registry, owner]);
  useEffect(() => {
    registry.activate(owner);
  }, [registry, owner]);
  return (
    <OwnerContext.Provider value={session}>{children}</OwnerContext.Provider>
  );
}

export function useDraftSession() {
  const registry = useContext(RegistryContext);
  const scope = useContext(OwnerContext);
  const active = useSyncExternalStore(
    registry?.subscribe ?? subscribeEmpty,
    registry?.getSnapshot ?? empty,
    empty,
  );
  return scope ?? active;
}
