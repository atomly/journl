"use client";
import { createContext, useContext } from "react";

/** Consumer behavior only; contains no storage, routing, or UI component types. */
export type EditorServices = {
  getBlockUrl?: (blockId: string) => string | undefined;
  openLink?: (href: string) => void;
  normalizeReferenceUrl?: (input: string) => string;
  onActionError?: (error: unknown) => void;
};
export const EditorServicesContext = createContext<EditorServices>({});
export function useEditorServices() {
  return useContext(EditorServicesContext);
}
