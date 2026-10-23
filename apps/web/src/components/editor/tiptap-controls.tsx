"use client";

import { Toolbar } from "@base-ui/react/toolbar";
import type { Editor } from "@tiptap/core";
import type { ComponentProps, ReactElement } from "react";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/cn";

/** Compose onto the actual control: no wrapper in menus or nested buttons. */
export function EditorHint({
  children,
  label,
  ...props
}: Omit<ComponentProps<typeof TooltipTrigger>, "children"> & {
  children: ReactElement;
  label: string;
}) {
  return (
    <TooltipProvider delay={350}>
      <Tooltip>
        <TooltipTrigger {...props} render={children} />
        <TooltipContent role="tooltip">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Restore ProseMirror's selection as well as DOM focus. Bare element.focus()
 * can replace a multi-range cell selection with the browser's text range. */
export function restoreEditorFocus(editor: Editor): false {
  if (!editor.isDestroyed) editor.view.focus();
  return false;
}

/** Toolbar.Button must own disabled state and wrap popup triggers so the
 * library's roving focus can skip unavailable controls correctly. */
export function EditorToolbarControl({
  label,
  disabled = false,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: ReactElement;
}) {
  return (
    <EditorHint label={label}>
      <Toolbar.Button
        disabled={disabled}
        focusableWhenDisabled={false}
        render={children}
      />
    </EditorHint>
  );
}

export function EditorMenuItem({
  hint,
  className,
  ...props
}: ComponentProps<typeof DropdownMenuItem> & { hint: string }) {
  return (
    <EditorHint label={hint}>
      <DropdownMenuItem
        {...props}
        className={cn("data-disabled:pointer-events-auto", className)}
      />
    </EditorHint>
  );
}
