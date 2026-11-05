import type { Editor } from "@tiptap/core";
import { createContext, useCallback, useContext, useMemo, useRef } from "react";
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
  getSelections: () => { text: string }[];
  prepareEdits: () => void;
  cancelEdits: () => void;
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
  const state = useRef({
    editors: new Map<EditorId, RegisteredEditor>(),
    focused: undefined as EditorId | undefined,
    listeners: new Set<() => void>(),
    reasoning: "instant" as AgentState["reasoning"],
    revision: 0,
    view: { name: "other" } as AgentState["view"],
  });
  const getEditors = useCallback(() => {
    const { editors, view, focused } = state.current;
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
  }, []);
  const notify = useCallback(() => {
    state.current.revision++;
    for (const listener of state.current.listeners) listener();
  }, []);
  const value = useMemo<Awareness>(
    () => ({
      cancelEdits: () => {
        for (const { session } of state.current.editors.values())
          if (["prepared", "generating"].includes(session.getSnapshot().status))
            session.cancel();
      },
      getEditors,
      getReasoning: () => state.current.reasoning,
      getRevision: () => state.current.revision,
      getSelections: () =>
        Array.from(getEditors().values(), ({ session }) => ({
          text: session.highlightedText(),
        })).filter(({ text }) => text),
      getView: () => state.current.view,
      prepareEdits: () => {
        for (const { session } of getEditors().values()) {
          try {
            session.prepare();
          } catch {
            /* The write tool reports unsupported selections without blocking read-only chat. */
          }
        }
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
        if (
          JSON.stringify({ ...state.current.view, title: undefined }) !==
          JSON.stringify({ ...view, title: undefined })
        ) {
          for (const { session } of state.current.editors.values())
            if (
              ["prepared", "generating"].includes(session.getSnapshot().status)
            )
              session.cancel();
        }
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
    [getEditors, notify],
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
