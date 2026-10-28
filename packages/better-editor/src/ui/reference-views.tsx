"use client";

import { useMemo } from "react";
import {
  type ReferenceViewStore,
  referenceViewStore,
  TiptapReferenceViews,
} from "./node-views";

/** Include the returned extension at mount; render its views where app context is available. */
export function useReferenceViews() {
  return useMemo(referenceViewStore, []);
}
export function ReferenceViews({ store }: { store: ReferenceViewStore }) {
  return <TiptapReferenceViews store={store} />;
}
