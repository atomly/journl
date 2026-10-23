"use client";
import { SquarePen } from "lucide-react";
import { createContext, useContext } from "react";
import { Button } from "~/components/ui/button";
import { useTrackedDrafts } from "./draft-activity-provider";

const Context = createContext({ enabled: false, tiptap: false });
export function EditorFrontendProvider({
  enabled,
  tiptap,
  children,
}: {
  enabled: boolean;
  tiptap: boolean;
  children: React.ReactNode;
}) {
  return (
    <Context.Provider value={{ enabled, tiptap: enabled && tiptap }}>
      {children}
    </Context.Provider>
  );
}
export const useTiptapPreview = () => useContext(Context).tiptap;
export function EditorPreviewSwitch() {
  const { enabled, tiptap } = useContext(Context);
  const drafts = useTrackedDrafts();
  const unsaved = drafts.some(({ draft }) => {
    const snapshot = draft.getSnapshot();
    return snapshot.isDirty || snapshot.recoveryCopies.length > 0;
  });
  if (!enabled) return null;
  const label = tiptap ? "Use current editor" : "Try Tiptap editor";
  return (
    <Button
      aria-label={label}
      className="shrink-0 max-md:size-8 max-md:p-0"
      disabled={unsaved}
      title={
        unsaved
          ? "Save or download your drafts before switching editors"
          : label
      }
      size="sm"
      variant="ghost"
      onClick={() => {
        // biome-ignore lint/suspicious/noDocumentCookie: Preview opt-in also supports WebKit.
        document.cookie = `journl-editor=${tiptap ? "blocknote" : "tiptap"}; Path=/; SameSite=Lax`;
        window.location.reload();
      }}
    >
      <SquarePen aria-hidden="true" className="size-4 md:hidden" />
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
}
