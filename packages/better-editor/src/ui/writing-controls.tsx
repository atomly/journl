"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import type { Editor } from "@tiptap/core";
import { redo, undo } from "@tiptap/pm/history";
import { NodeSelection } from "@tiptap/pm/state";
import { Redo2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  canIndentBlock,
  duplicateSelectedBlock,
  indentBlock,
  selectedBlock,
} from "../engine/commands";
import { blockAt } from "../engine/identity";
import { moveSelectedBlock, removeSelectedBlock } from "../engine/writing";
import { EditorMenuItem, restoreEditorFocus } from "./controls";
import { useEditorServices } from "./editor-services";
import { useEditorSnapshot } from "./use-editor-snapshot";

export function BlockActions({
  editor,
  blockId,
}: {
  editor: Editor;
  blockId?: string;
}) {
  const current = useEditorSnapshot(editor) ?? editor.state;
  const services = useEditorServices();
  const targetState = (base = editor.state) => {
    if (!blockId) return base;
    try {
      const target = blockAt(base.doc, blockId);
      return base.apply(
        base.tr.setSelection(NodeSelection.create(base.doc, target.pos)),
      );
    } catch {
      return null;
    }
  };
  const execute = (
    command: (
      state: Editor["state"],
    ) => import("@tiptap/pm/state").Transaction | null,
  ) => {
    const target = targetState();
    if (!target) return;
    const tr = command(target);
    if (tr) editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
  };
  const state = targetState(current);
  if (!state) return null;
  const run = (direction?: -1 | 1) =>
    execute((state) =>
      direction
        ? moveSelectedBlock(state, direction)
        : removeSelectedBlock(state, () => crypto.randomUUID()),
    );
  return (
    <>
      <EditorMenuItem
        hint="Indent (Tab)"
        disabled={!canIndentBlock(state)}
        onClick={() => execute((state) => indentBlock(state))}
      >
        Indent
      </EditorMenuItem>
      <EditorMenuItem
        hint="Outdent (Shift+Tab)"
        disabled={!canIndentBlock(state, true)}
        onClick={() => execute((state) => indentBlock(state, true))}
      >
        Outdent
      </EditorMenuItem>
      <DropdownMenuSeparator />
      <EditorMenuItem
        hint="Duplicate (⌘/Ctrl+D)"
        onClick={() =>
          execute((state) =>
            duplicateSelectedBlock(state, () => crypto.randomUUID()),
          )
        }
      >
        Duplicate block
      </EditorMenuItem>
      <EditorMenuItem hint="Move up (⌘/Ctrl+Shift+↑)" onClick={() => run(-1)}>
        Move block up
      </EditorMenuItem>
      <EditorMenuItem hint="Move down (⌘/Ctrl+Shift+↓)" onClick={() => run(1)}>
        Move block down
      </EditorMenuItem>
      <EditorMenuItem
        hint="Copy block link"
        disabled={!services.getBlockUrl}
        onClick={async () => {
          const target = targetState();
          const id = target && selectedBlock(target)?.id;
          if (!id) return;
          const url = services.getBlockUrl?.(id);
          if (!url) return;
          try {
            await navigator.clipboard.writeText(url);
          } catch (error) {
            services.onActionError?.(error);
          }
        }}
      >
        Copy block link
      </EditorMenuItem>
      <EditorMenuItem
        hint="Delete block and children"
        variant="destructive"
        onClick={() => run()}
      >
        {selectedBlock(state)?.node.firstChild?.type.name === "table"
          ? "Delete table"
          : "Delete block"}
      </EditorMenuItem>
      <DropdownMenuSeparator />
      <EditorMenuItem
        hint="Undo (⌘/Ctrl+Z)"
        disabled={!undo(editor.state)}
        onClick={() => {
          undo(editor.state, editor.view.dispatch);
          editor.view.focus();
        }}
      >
        <Undo2 />
        Undo
      </EditorMenuItem>
      <EditorMenuItem
        hint="Redo (⌘/Ctrl+Shift+Z)"
        disabled={!redo(editor.state)}
        onClick={() => {
          redo(editor.state, editor.view.dispatch);
          editor.view.focus();
        }}
      >
        <Redo2 />
        Redo
      </EditorMenuItem>
    </>
  );
}

/** Context actions do not replace native link, selected-text, touch or pen menus. */
export function TiptapContextMenu({ editor }: { editor?: Editor }) {
  const [context, setContext] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const pointer = useRef("mouse");
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const show = (
      event: MouseEvent | KeyboardEvent,
      target: Element,
      keyboard: boolean,
    ) => {
      if (
        !editor.isEditable ||
        (!keyboard &&
          (pointer.current !== "mouse" ||
            !window.matchMedia("(hover: hover) and (pointer: fine)")
              .matches)) ||
        target.closest("a[href],button,input,select,textarea") ||
        (!editor.state.selection.empty &&
          !(editor.state.selection instanceof NodeSelection))
      )
        return;
      const id = keyboard
        ? selectedBlock(editor.state)?.id
        : target.closest<HTMLElement>("[data-block-id]")?.dataset.blockId;
      if (!id) return;
      const block = blockAt(editor.state.doc, id);
      const rect = (
        editor.view.nodeDOM(block.pos) as HTMLElement | null
      )?.getBoundingClientRect();
      event.preventDefault();
      setContext({
        id,
        x: "clientX" in event ? event.clientX : (rect?.left ?? 0),
        y: "clientY" in event ? event.clientY : (rect?.top ?? 0),
      });
    };
    const pointerdown = (event: PointerEvent) => {
      pointer.current = event.pointerType;
    };
    const contextmenu = (event: MouseEvent) => {
      if (event.target instanceof Element) show(event, event.target, false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        (event.key === "ContextMenu" ||
          (event.shiftKey && event.key === "F10")) &&
        event.target instanceof Element
      )
        show(event, event.target, true);
    };
    dom.addEventListener("pointerdown", pointerdown);
    dom.addEventListener("contextmenu", contextmenu);
    dom.addEventListener("keydown", keyboard);
    return () => {
      dom.removeEventListener("pointerdown", pointerdown);
      dom.removeEventListener("contextmenu", contextmenu);
      dom.removeEventListener("keydown", keyboard);
    };
  }, [editor]);
  if (!editor || !context) return null;
  return (
    <DropdownMenu
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) setContext(null);
      }}
    >
      <DropdownMenuTrigger
        aria-label="Context block actions"
        tabIndex={-1}
        style={{
          height: 1,
          left: context.x,
          opacity: 0,
          pointerEvents: "none",
          position: "fixed",
          top: context.y,
          width: 1,
        }}
      />
      <DropdownMenuContent
        data-tiptap-controls=""
        data-tiptap-owner={editor.instanceId}
        finalFocus={() => {
          return restoreEditorFocus(editor);
        }}
      >
        <BlockActions editor={editor} blockId={context.id} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
