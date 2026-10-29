"use client";

import { Toolbar } from "@base-ui/react/toolbar";
import type { Editor } from "@tiptap/core";
import type { ComponentProps } from "react";
import type { EditorCommand } from "../engine/actions";
import { useEditorCommand } from "./use-editor-command";

export type CommandButtonProps = Omit<
  ComponentProps<typeof Toolbar.Button>,
  "children"
> & { editor?: Editor; command: EditorCommand; children?: React.ReactNode };

/** Base UI owns element/ref composition; the command owns editor behavior. */
export function CommandButton({
  editor: explicit,
  command,
  onMouseDown,
  onClick,
  disabled,
  ...props
}: CommandButtonProps) {
  const state = useEditorCommand(command, explicit);
  return (
    <Toolbar.Button
      {...props}
      disabled={disabled || state.disabled}
      aria-pressed={state?.active}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        event.preventDefault();
      }}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) state.run();
      }}
    />
  );
}
