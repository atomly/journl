"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { selectedBlock } from "../engine/commands";
import { blockAt } from "../engine/identity";
import { restoreEditorFocus } from "./controls";
import { useEditorInstance } from "./editor-root";
/** Context actions do not replace native link, selected-text, touch or pen menus. */
export function EditorContextMenu({
  editor: explicit,
  renderMenu,
}: {
  editor?: Editor;
  renderMenu: (target: { editor: Editor; blockId: string }) => ReactNode;
}) {
  const editor = useEditorInstance(explicit);
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
        {renderMenu({ blockId: context.id, editor })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
