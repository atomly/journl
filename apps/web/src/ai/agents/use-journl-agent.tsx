import type { BlockPrimitive, EditorPrimitive } from "@acme/blocknote/schema";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { JournlAgentState } from "./journl-agent-state";

export type BlockSelection = {
  editor: EditorPrimitive;
  blockIds: Set<BlockPrimitive["id"]>;
  blocks: BlockPrimitive[];
  markdown: string;
  text: string;
};

type JournlEditor = {
  id: JournlAgentState["activeEditors"][number];
  editor: EditorPrimitive;
};

const JournlAgentContext = createContext<{
  unsetEditor: (id: JournlEditor["id"]) => void;
  unsetEditorSelections: (editor: EditorPrimitive) => void;
  unsetSelection: (selection: BlockSelection) => void;
  getEditors: () => Map<JournlEditor["id"], JournlEditor>;
  getSelection: (
    selection: Pick<BlockSelection, "editor" | "blockIds">,
  ) => BlockSelection | undefined;
  getSelections: () => BlockSelection[];
  getReasoning: () => JournlAgentState["reasoning"];
  getView: () => JournlAgentState["view"];
  setEditor: (activeEditor: JournlEditor) => void;
  setReasoning: (reasoning: JournlAgentState["reasoning"]) => void;
  setSelection: (selection: BlockSelection) => void;
  setView: (view: JournlAgentState["view"]) => void;
} | null>(null);

type JournlAgentAwarenessProviderProps = {
  children: React.ReactNode;
};

/**
 * JournlAgentProvider is a provider that allows the Journl agent to be aware of the current page that the user is interacting with.
 * For example, it allows the agent to be aware of the current state of the editor.
 *
 * @privateRemarks
 * The AI SDK `useChat` parameters are similar to an initial state, so we need to use a reference to access the data.
 * But we also need a state so that the UI can react to changes, so we have a rare hybrid of a reference and a state.
 */
export function JournlAgentProvider({
  children,
}: JournlAgentAwarenessProviderProps) {
  const [, _setReasoning] = useState<JournlAgentState["reasoning"]>("instant");
  const [, _setSelectedBlocks] = useState<BlockSelection[]>([]);
  const [, _setView] = useState<JournlAgentState["view"]>({
    name: "other",
  });

  const ref = useRef<{
    editors: Map<JournlEditor["id"], JournlEditor>;
    reasoning: JournlAgentState["reasoning"];
    selectedBlocks: BlockSelection[];
    view: JournlAgentState["view"];
  }>({
    editors: new Map(),
    reasoning: "instant",
    selectedBlocks: [],
    view: {
      name: "other",
    },
  });

  const unsetEditor = useCallback((id: JournlEditor["id"]) => {
    ref.current.editors.delete(id);
  }, []);

  const unsetEditorSelections = useCallback((editor: EditorPrimitive) => {
    _setSelectedBlocks((prev) => {
      const newSelectedBlocks = prev.filter((s) => s.editor !== editor);
      ref.current.selectedBlocks = newSelectedBlocks;
      return newSelectedBlocks;
    });
  }, []);

  const unsetSelection = useCallback((selection: BlockSelection) => {
    _setSelectedBlocks((prev) => {
      const newSelectedBlocks = prev.filter((s) => s !== selection);
      ref.current.selectedBlocks = newSelectedBlocks;
      return newSelectedBlocks;
    });
  }, []);

  const getEditors = useCallback(() => {
    return ref.current.editors;
  }, []);

  const getReasoning = useCallback(() => {
    return ref.current.reasoning;
  }, []);

  const getSelection = useCallback(
    (selection: Pick<BlockSelection, "editor" | "blockIds">) => {
      return ref.current.selectedBlocks.find(
        (s) =>
          s.editor === selection.editor &&
          Array.from(s.blockIds).every((b) => selection.blockIds.has(b)),
      );
    },
    [],
  );

  const getSelections = useCallback(() => {
    return ref.current.selectedBlocks;
  }, []);

  const getView = useCallback(() => {
    return ref.current.view;
  }, []);

  const setEditor = useCallback((activeEditor: JournlEditor) => {
    ref.current.editors.set(activeEditor.id, activeEditor);
  }, []);

  const setSelection = useCallback((selection: BlockSelection) => {
    _setSelectedBlocks((prev) => {
      const newSelectedBlocks = [...prev, selection];
      ref.current.selectedBlocks = newSelectedBlocks;
      return newSelectedBlocks;
    });
  }, []);

  const setReasoning = useCallback(
    (reasoning: JournlAgentState["reasoning"]) => {
      ref.current.reasoning = reasoning;
      _setReasoning(reasoning);
    },
    [],
  );

  const setView = useCallback((view: JournlAgentState["view"]) => {
    ref.current.view = view;
    _setView(view);
  }, []);

  return (
    <JournlAgentContext.Provider
      value={{
        getEditors,
        getReasoning,
        getSelection,
        getSelections,
        getView,
        setEditor,
        setReasoning,
        setSelection,
        setView: setView,
        unsetEditor,
        unsetEditorSelections,
        unsetSelection,
      }}
    >
      {children}
    </JournlAgentContext.Provider>
  );
}

export function useJournlAgent() {
  const context = useContext(JournlAgentContext);
  if (!context) {
    throw new Error("JournlAgentContext not found");
  }
  return context;
}
