"use client";

import { createContext, useContext, useMemo, useState } from "react";

type AppLayoutContextValue = {
  scrollElement: HTMLElement | null;
  setScrollElement: (element: HTMLElement | null) => void;
};

const AppLayoutContext = createContext<AppLayoutContextValue | undefined>(
  undefined,
);

type AppLayoutProviderProps = {
  children: React.ReactNode;
};

export function AppLayoutProvider({ children }: AppLayoutProviderProps) {
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);

  const value = useMemo(
    () => ({
      scrollElement,
      setScrollElement,
    }),
    [scrollElement],
  );

  return (
    <AppLayoutContext.Provider value={value}>
      {children}
    </AppLayoutContext.Provider>
  );
}

export function useAppLayout() {
  const context = useContext(AppLayoutContext);

  if (!context) {
    throw new Error("useAppLayout must be used within AppLayoutProvider");
  }

  return context;
}
