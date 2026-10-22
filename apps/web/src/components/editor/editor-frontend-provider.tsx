"use client";
import { createContext, useContext } from "react";
import { Button } from "~/components/ui/button";

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
  if (!enabled) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        // biome-ignore lint/suspicious/noDocumentCookie: Preview opt-in also supports WebKit.
        document.cookie = `journl-editor=${tiptap ? "blocknote" : "tiptap"}; Path=/; SameSite=Lax`;
        window.location.reload();
      }}
    >
      {tiptap ? "Use current editor" : "Try Tiptap editor"}
    </Button>
  );
}
