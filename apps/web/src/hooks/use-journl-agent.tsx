import type { Editor } from "@tiptap/core";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { DocumentEditSession } from "~/ai/client/document-edit-session";
import type { JournlAgentContext as AgentState } from "~/ai/mastra/agents/journl-agent-context";

type EditorId = AgentState["activeEditors"][number];
type RegisteredEditor = {
  id: EditorId;
  editor: Editor;
  session: DocumentEditSession;
};
type Awareness = {
  subscribe: (listener: () => void) => () => void;
  getRevision: () => number;
  whenEditorReady: (id: EditorId) => Promise<void>;
  registerEditor: (
    id: EditorId,
    editor: Editor,
  ) => { session: DocumentEditSession; dispose: () => void };
  getEditors: () => Map<EditorId, RegisteredEditor>;
  getEditTarget: () => RegisteredEditor | undefined;
  getSelections: () => { text: string }[];
  prepareEdits: (expected?: EditorId) => boolean;
  cancelEdits: () => void;
  beginEditRequest: () => void;
  claimWriteRun: () => boolean;
  getReasoning: () => AgentState["reasoning"];
  getView: () => AgentState["view"];
  setReasoning: (reasoning: AgentState["reasoning"]) => void;
  setView: (view: AgentState["view"]) => void;
};
const JournlAgentContext = createContext<Awareness | null>(null);

export function JournlAgentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const state = useRef({
    editors: new Map<EditorId, RegisteredEditor>(),
    editTarget: undefined as RegisteredEditor | undefined,
    focused: undefined as EditorId | undefined,
    listeners: new Set<() => void>(),
    pathname,
    reasoning: "instant" as AgentState["reasoning"],
    revision: 0,
    view: { name: "other" } as AgentState["view"],
    writeClaimed: true,
  });
  const getView = useCallback((): AgentState["view"] => {
    const { pathname, view } = state.current;
    const page = pathname?.match(/^\/pages\/([^/]+)\/?$/);
    if (page)
      return {
        id: page[1] ?? "",
        name: "page",
        title: view.name === "page" && view.id === page[1] ? view.title : "",
      };
    const entry = pathname?.match(/^\/journal\/(\d{4}-\d{2}-\d{2})\/?$/);
    if (entry) return { date: entry[1] ?? "", name: "journal-entry" };
    return pathname === "/journal" ? { name: "journal" } : { name: "other" };
  }, []);
  const getEditors = useCallback(() => {
    const { editors, focused } = state.current;
    const view = getView();
    const id: EditorId | undefined =
      view.name === "page"
        ? `page:${view.id}`
        : view.name === "journal-entry"
          ? `journal-entry:${view.date}`
          : view.name === "journal"
            ? focused
            : undefined;
    const entry = id && editors.get(id);
    return new Map(
      entry && !entry.editor.isDestroyed ? [[entry.id, entry]] : [],
    );
  }, [getView]);
  const notify = useCallback(() => {
    state.current.revision++;
    for (const listener of state.current.listeners) listener();
  }, []);
  useLayoutEffect(() => {
    if (state.current.pathname === pathname) return;
    state.current.pathname = pathname;
    for (const { session } of state.current.editors.values())
      if (["prepared", "generating"].includes(session.getSnapshot().status))
        session.cancel();
    notify();
  }, [pathname, notify]);
  const value = useMemo<Awareness>(
    () => ({
      beginEditRequest: () => {
        state.current.writeClaimed = false;
      },
      cancelEdits: () => {
        state.current.writeClaimed = true;
        for (const { session } of state.current.editors.values())
          if (["prepared", "generating"].includes(session.getSnapshot().status))
            session.cancel();
      },
      claimWriteRun: () => {
        if (state.current.writeClaimed) return false;
        state.current.writeClaimed = true;
        return true;
      },
      getEditors,
      getEditTarget: () => state.current.editTarget,
      getReasoning: () => state.current.reasoning,
      getRevision: () => state.current.revision,
      getSelections: () =>
        Array.from(getEditors().values(), ({ session }) => ({
          text: session.highlightedText(),
        })).filter(({ text }) => text),
      getView,
      prepareEdits: (expected) => {
        const editors = getEditors();
        state.current.editTarget = expected
          ? editors.get(expected)
          : editors.values().next().value;
        if (!state.current.editTarget) return false;
        for (const { session } of [state.current.editTarget]) {
          try {
            session.prepare();
          } catch {
            /* The write tool reports unsupported selections without blocking read-only chat. */
          }
        }
        return true;
      },
      registerEditor: (id, editor) => {
        const session = new DocumentEditSession(editor, id);
        const entry = { editor, id, session };
        state.current.editors.set(id, entry);
        const focus = () => {
          state.current.focused = id;
          notify();
        };
        editor.on("focus", focus);
        editor.on("selectionUpdate", notify);
        notify();
        return {
          dispose: () => {
            editor.off("focus", focus);
            editor.off("selectionUpdate", notify);
            session.destroy();
            if (state.current.editors.get(id) === entry)
              state.current.editors.delete(id);
            notify();
          },
          session,
        };
      },
      setReasoning: (reasoning) => {
        state.current.reasoning = reasoning;
        notify();
      },
      setView: (view) => {
        state.current.view = view;
        notify();
      },
      subscribe: (listener) => {
        state.current.listeners.add(listener);
        return () => {
          state.current.listeners.delete(listener);
        };
      },
      whenEditorReady: (id) =>
        new Promise<void>((resolve, reject) => {
          let timer: ReturnType<typeof setTimeout>;
          const cleanup = () => {
            clearTimeout(timer);
            state.current.listeners.delete(check);
          };
          const check = () => {
            if (getEditors().has(id)) {
              cleanup();
              resolve();
            }
          };
          timer = setTimeout(() => {
            cleanup();
            reject(
              new Error(
                "The new page editor did not become ready. Open the page and retry.",
              ),
            );
          }, 15000);
          state.current.listeners.add(check);
          check();
        }),
    }),
    [getEditors, getView, notify],
  );
  return (
    <JournlAgentContext.Provider value={value}>
      {children}
    </JournlAgentContext.Provider>
  );
}

export function useJournlAgent() {
  const context = useContext(JournlAgentContext);
  if (!context) throw new Error("JournlAgentContext not found");
  return context;
}
