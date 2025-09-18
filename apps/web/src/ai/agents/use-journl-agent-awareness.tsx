import type { BlockPrimitive, EditorPrimitive } from "@acme/blocknote/schema";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { JournlAgentContext } from "./journl-agent-context";

export type BlockSelection = {
  editor: EditorPrimitive;
  blockIds: Set<BlockPrimitive["id"]>;
  blocks: BlockPrimitive[];
  markdown: string;
  text: string;
};

type JournlEditor = JournlAgentContext["activeEditors"][number] & {
  editor: EditorPrimitive;
};

const JournlAgentAwarenessContext = createContext<{
  forgetEditor: (id: string) => void;
  forgetEditorSelections: (editor: EditorPrimitive) => void;
  forgetSelection: (selection: BlockSelection) => void;
  getEditors: () => Map<string, JournlEditor>;
  getSelection: (
    selection: Pick<BlockSelection, "editor" | "blockIds">,
  ) => BlockSelection | undefined;
  getSelections: () => BlockSelection[];
  getView: () => JournlAgentContext["view"];
  rememberEditor: (activeEditor: JournlEditor) => void;
  rememberSelection: (selection: BlockSelection) => void;
  rememberView: (view: JournlAgentContext["view"]) => void;
} | null>(null);

/**
 * JournlAgentAwarenessProvider is a provider that allows the Journl agent to be aware of the current page that the user is interacting with.
 * For example, it allows the agent to be aware of the current state of the editor.
 *
 * @privateRemarks
 * The AI SDK `useChat` parameters are similar to an initial state, so we need to use a reference to access the data.
 * But we also need a state so that the UI can react to changes, so we have a rare hybrid of a reference and a state.
 */
export function JournlAgentAwarenessProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [_, setSelectedBlocks] = useState<BlockSelection[]>([]);
  const ref = useRef<{
    view: JournlAgentContext["view"];
    editors: Map<string, JournlEditor>;
    selectedBlocks: BlockSelection[];
  }>({
    editors: new Map(),
    selectedBlocks: [],
    view: {
      name: "other",
    },
  });

  const forgetEditor = useCallback((id: string) => {
    ref.current.editors.delete(id);
  }, []);

  const forgetEditorSelections = useCallback((editor: EditorPrimitive) => {
    setSelectedBlocks((prev) => {
      const newSelectedBlocks = prev.filter((s) => s.editor !== editor);
      ref.current.selectedBlocks = newSelectedBlocks;
      return newSelectedBlocks;
    });
  }, []);

  const forgetSelection = useCallback((selection: BlockSelection) => {
    setSelectedBlocks((prev) => {
      const newSelectedBlocks = prev.filter((s) => s !== selection);
      ref.current.selectedBlocks = newSelectedBlocks;
      return newSelectedBlocks;
    });
  }, []);

  const getEditors = useCallback(() => {
    return ref.current.editors;
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

  const rememberEditor = useCallback((activeEditor: JournlEditor) => {
    const id =
      activeEditor.type === "journal-entry"
        ? activeEditor.date
        : activeEditor.id;
    ref.current.editors.set(id, {
      ...activeEditor,
      editor: activeEditor.editor,
    });
  }, []);

  const rememberSelection = useCallback((selection: BlockSelection) => {
    setSelectedBlocks((prev) => {
      const newSelectedBlocks = [...prev, selection];
      ref.current.selectedBlocks = newSelectedBlocks;
      return newSelectedBlocks;
    });
  }, []);

  const rememberView = useCallback((view: JournlAgentContext["view"]) => {
    ref.current.view = view;
  }, []);

  return (
    <JournlAgentAwarenessContext.Provider
      value={{
        forgetEditor,
        forgetEditorSelections,
        forgetSelection,
        getEditors,
        getSelection,
        getSelections,
        getView,
        rememberEditor,
        rememberSelection,
        rememberView,
      }}
    >
      {children}
    </JournlAgentAwarenessContext.Provider>
  );
}

export function useJournlAgentAwareness() {
  const context = useContext(JournlAgentAwarenessContext);
  if (!context) {
    throw new Error("JournlAgentViewContext not found");
  }
  return context;
}
