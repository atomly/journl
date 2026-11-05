"use client";

import { CellSelection } from "@tiptap/pm/tables";
import { useMemo } from "react";
import type { EditorCommand } from "../engine/actions";
import {
  selectedBlock,
  textMarkActive,
  toggleTextMark,
} from "../engine/commands";
import { CommandButton, type CommandButtonProps } from "./command-button";

type MarkButtonProps = Omit<CommandButtonProps, "command"> & {
  mark: "bold" | "italic" | "underline" | "strike" | "code";
};
export function MarkButton({
  mark,
  children = mark,
  ...props
}: MarkButtonProps) {
  const command = useMemo<EditorCommand>(
    () => ({
      canRun: (editor) => {
        const markType = editor.schema.marks[mark];
        const body = editor.state.selection.$from.parent.isTextblock
          ? editor.state.selection.$from.parent
          : selectedBlock(editor.state)?.node.firstChild;
        return Boolean(
          markType &&
            (editor.state.selection instanceof CellSelection ||
              body?.type.allowsMarkType(markType)),
        );
      },
      isActive: (editor) => textMarkActive(editor.state, mark),
      run: (editor) => {
        const transaction = toggleTextMark(editor.state, mark);
        if (transaction) editor.view.dispatch(transaction);
      },
    }),
    [mark],
  );
  return (
    <CommandButton {...props} command={command}>
      {children}
    </CommandButton>
  );
}
export function BoldButton(props: Omit<MarkButtonProps, "mark">) {
  return <MarkButton aria-label="Bold" {...props} mark="bold" />;
}
export function ItalicButton(props: Omit<MarkButtonProps, "mark">) {
  return <MarkButton aria-label="Italic" {...props} mark="italic" />;
}
