import type { Editor } from "@tiptap/core";

/** Applicability and selected-state checks must be cheap and side-effect free. */
export type EditorCommand = {
  run: (editor: Editor) => void;
  canRun?: (editor: Editor) => boolean;
  isActive?: (editor: Editor) => boolean;
};
