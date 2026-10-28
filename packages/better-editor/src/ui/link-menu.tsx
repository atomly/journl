"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@acme/ui/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import type { Editor } from "@tiptap/core";
import type { SelectionBookmark } from "@tiptap/pm/state";
import {
  type ComponentProps,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { setTextMark } from "../engine/commands";
import { captureLink } from "../engine/references";
import { safeEditorUrl } from "../engine/schema";
import { restoreEditorFocus } from "./controls";
import { useEditorInstance, useEditorSelector } from "./editor-root";

export type LinkMenuProps = {
  editor?: Editor;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
  renderTrigger?: ReactElement;
  contentProps?: ComponentProps<typeof PopoverContent>;
};

/** A replaceable link control retains and maps its captured selection while open. */
export function LinkMenu({
  editor: explicit,
  open: controlled,
  onOpenChange,
  label = "Insert link",
  renderTrigger,
  contentProps,
}: LinkMenuProps) {
  const editor = useEditorInstance(explicit);
  const available = useEditorSelector(
    (instance) => instance.isEditable && Boolean(instance.schema.marks.link),
    editor,
  );
  const [uncontrolled, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const bookmark = useRef<SelectionBookmark | undefined>(undefined);
  const valid = useRef(true);
  const open = controlled ?? uncontrolled;
  const change = (value: boolean) => {
    setOpen(value);
    onOpenChange?.(value);
  };
  useEffect(() => {
    if (!editor || !open) return;
    bookmark.current = editor.state.selection.getBookmark();
    valid.current = true;
    setUrl(captureLink(editor.state)?.href ?? "");
    const map = ({
      transaction,
    }: {
      transaction: import("@tiptap/pm/state").Transaction;
    }) => {
      try {
        const selection = bookmark.current?.resolve(transaction.before);
        if (
          selection &&
          !selection.empty &&
          transaction.mapping.map(selection.from, 1) >=
            transaction.mapping.map(selection.to, -1)
        )
          valid.current = false;
        bookmark.current = bookmark.current?.map(transaction.mapping);
      } catch {
        valid.current = false;
      }
    };
    editor.on("transaction", map);
    return () => {
      editor.off("transaction", map);
      bookmark.current = undefined;
    };
  }, [editor, open]);
  if (!editor) return null;
  return (
    <Popover open={open} onOpenChange={change}>
      <Toolbar.Button
        disabled={!available}
        aria-label={label}
        render={
          <PopoverTrigger
            render={renderTrigger ?? <button type="button">{label}</button>}
            onMouseDown={(event) => event.preventDefault()}
          />
        }
      />
      <PopoverContent
        {...contentProps}
        data-tiptap-controls=""
        data-tiptap-owner={editor.instanceId}
        finalFocus={() => restoreEditorFocus(editor)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const href = safeEditorUrl(url);
            if (
              !href ||
              !valid.current ||
              !bookmark.current ||
              !editor.isEditable
            )
              return;
            try {
              const selection = bookmark.current.resolve(editor.state.doc);
              const state = editor.state.apply(
                editor.state.tr.setSelection(selection),
              );
              const mark = state.schema.marks.link;
              if (!mark) return;
              const existing = captureLink(state);
              const transaction =
                !existing && state.selection.empty
                  ? state.tr.replaceSelectionWith(
                      state.schema.text(url, [mark.create({ href })]),
                    )
                  : setTextMark(state, "link", { href }, existing ?? undefined);
              if (transaction) editor.view.dispatch(transaction);
              change(false);
              editor.view.focus();
            } catch {
              valid.current = false;
            }
          }}
        >
          <label>
            Link URL
            <input
              aria-label="Link URL"
              type="text"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
          </label>
          <button type="submit">Apply link</button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
