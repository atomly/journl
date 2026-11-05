"use client";
import type { DocumentBlock, ReferenceProps } from "@acme/document";
import {
  memo,
  type ReactNode,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { ReferenceSurface } from "./node-views";
import { type ReferenceView, referenceViewStore } from "./reference-view-store";

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
const EMPTY: readonly number[] = [];
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
  return views.map((id) => (
    <ReferencePortal key={id} id={id} store={store} {...options} />
  ));
}
const ReferencePortal = memo(function ReferencePortal({
  id,
  store,
  ...options
}: ReferenceViewsOptions & { id: number; store: ReferenceViewStore }) {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribeView(id, listener),
    [id, store],
  );
  const getSnapshot = useCallback(() => store.getView(id), [id, store]);
  const view = useSyncExternalStore(subscribe, getSnapshot, () => undefined);
  return view
    ? createPortal(<ReferenceSurface view={view} {...options} />, view.dom, id)
    : null;
});
