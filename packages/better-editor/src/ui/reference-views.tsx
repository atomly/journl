"use client";
import type { DocumentBlock, ReferenceProps } from "@acme/document";
import { type ReactNode, useMemo, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  ReferenceSurface,
  type ReferenceView,
  referenceViewStore,
} from "./node-views";
export type ReferenceViewStore = ReturnType<typeof referenceViewStore>;
export type ReferenceActionTarget = Pick<
  ReferenceView,
  "editor" | "node" | "getPos"
> & { withinTable: boolean; props: ReferenceProps };
export type ReferenceViewsOptions = {
  renderEmbeddedContent?: (blocks: readonly DocumentBlock[]) => ReactNode;
  renderActions?: (target: ReferenceActionTarget) => ReactNode;
  maxEmbedDepth?: number;
};
const EMPTY: ReferenceView[] = [];
/** The consumer opts into this presentation extension and supplies its content. */
export function useReferenceViews() {
  return useMemo(referenceViewStore, []);
}
export function ReferenceViews({
  store,
  ...options
}: { store: ReferenceViewStore } & ReferenceViewsOptions) {
  const views = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => EMPTY,
  );
  return views.map((view) =>
    createPortal(
      <ReferenceSurface view={view} {...options} />,
      view.dom,
      view.key,
    ),
  );
}
