"use client";
import { ExploreOwnerContext } from "./explore-state";
export function ExploreStateProvider({
  owner,
  children,
}: {
  owner?: string;
  children: React.ReactNode;
}) {
  return (
    <ExploreOwnerContext.Provider key={owner} value={owner}>
      {children}
    </ExploreOwnerContext.Provider>
  );
}
