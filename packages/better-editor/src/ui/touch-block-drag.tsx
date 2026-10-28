"use client";
import {
  DndContext,
  type DragMoveEvent,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { editBlocks, selectedBlock, selectedBlocks } from "../engine/commands";
import { blockAt } from "../engine/identity";

type Drop = {
  parentId: string | null;
  afterId: string | null;
  top: number;
  left: number;
  width: number;
};
function destination(
  editor: Editor,
  ids: string[],
  x: number,
  y: number,
): Drop | null {
  const root = editor.view.dom;
  const bounds = root.getBoundingClientRect();
  if (
    x < bounds.left - 64 ||
    x > bounds.right + 16 ||
    y < bounds.top ||
    y > bounds.bottom
  )
    return null;
  const row = [
    ...root.querySelectorAll<HTMLElement>("[data-better-editor-body]"),
  ]
    .filter((row) => row.closest(".better-editor-tiptap") === root)
    .find((row) => {
      const rect = row.getBoundingClientRect();
      return rect.height > 0 && y >= rect.top && y <= rect.bottom;
    });
  const wrapper = row?.closest<HTMLElement>("[data-block-id]");
  if (!row || !wrapper?.dataset.blockId) return null;
  // Never drop onto a selected subtree, including a selected parent's children.
  let ancestor: HTMLElement | null = wrapper;
  while (ancestor && ancestor !== root) {
    if (ids.includes(ancestor.dataset.blockId ?? "")) return null;
    ancestor = ancestor.parentElement;
  }
  const target = blockAt(editor.state.doc, wrapper.dataset.blockId);
  const state = editor.state.apply(
    editor.state.tr.setSelection(
      NodeSelection.create(editor.state.doc, target.pos),
    ),
  );
  const block = selectedBlock(state);
  if (!block) return null;
  const rect = row.getBoundingClientRect();
  const after = y >= rect.top + rect.height / 2;
  let afterId: string | null = after ? block.id : null;
  if (!after) {
    for (let i = block.index - 1; i >= 0; i--) {
      const previous = block.siblings.child(i).attrs.id as string;
      if (!ids.includes(previous)) {
        afterId = previous;
        break;
      }
    }
  }
  return {
    afterId,
    left: rect.left,
    parentId: block.parentId,
    top: after ? rect.bottom : rect.top,
    width: rect.width,
  };
}

type Handle = Pick<
  ReturnType<typeof useDraggable>,
  "listeners" | "attributes" | "setActivatorNodeRef"
>;
function DraggableHandle({
  editor,
  id,
  enabled,
  children,
}: {
  editor: Editor;
  id: string;
  enabled: boolean;
  children: (handle: Handle) => ReactNode;
}) {
  const handle = useDraggable({ disabled: !enabled, id });
  useEffect(() => {
    try {
      const node = editor.view.nodeDOM(blockAt(editor.state.doc, id).pos);
      if (node instanceof HTMLElement) handle.setNodeRef(node);
    } catch {
      handle.setNodeRef(null);
    }
    return () => handle.setNodeRef(null);
  }, [editor, id, handle.setNodeRef]);
  return children(handle);
}
/** dnd-kit owns touch activation, cancellation, auto-scroll and gesture listeners.
 * BetterEditor only maps a drop to validated document operations. Text keeps native touch behavior. */
export function TouchBlockDrag({
  editor,
  id,
  enabled,
  select,
  onActiveChange,
  children,
}: {
  editor: Editor;
  id: string;
  enabled: boolean;
  select: () => void;
  onActiveChange: (active: boolean) => void;
  children: (handle: Handle) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );
  const ids = useRef<string[]>([]);
  const [drop, setDrop] = useState<Drop | null>(null);
  const resolve = (event: DragMoveEvent) => {
    const touch =
      "touches" in event.activatorEvent
        ? (event.activatorEvent as TouchEvent).touches[0]
        : undefined;
    if (!touch) return null;
    try {
      return destination(
        editor,
        ids.current,
        touch.clientX + event.delta.x,
        touch.clientY + event.delta.y,
      );
    } catch {
      return null;
    }
  };
  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => {
        onActiveChange(true);
        select();
        ids.current = selectedBlocks(editor.state).map((block) => block.id);
      }}
      onDragMove={(event) => setDrop(resolve(event))}
      onDragCancel={() => {
        onActiveChange(false);
        ids.current = [];
        setDrop(null);
      }}
      onDragEnd={(event) => {
        onActiveChange(false);
        const target = resolve(event);
        const moving = ids.current;
        ids.current = [];
        setDrop(null);
        if (
          !target ||
          !moving.length ||
          editor.isDestroyed ||
          !editor.isEditable
        )
          return;
        try {
          let afterId = target.afterId;
          const operations = moving.map((id) => {
            const operation = {
              afterId,
              id,
              parentId: target.parentId,
              type: "move" as const,
            };
            afterId = id;
            return operation;
          });
          editor.view.dispatch(
            editBlocks(editor.state.tr, operations, moving[0]).scrollIntoView(),
          );
        } catch {
          /* A concurrent removal or invalid destination cancels the gesture. */
        }
      }}
      accessibility={{
        announcements: {
          onDragCancel: () => "Block move cancelled.",
          onDragEnd: () => "Block move finished.",
          onDragOver: () => undefined,
          onDragStart: () => "Moving selected blocks.",
        },
        screenReaderInstructions: {
          draggable:
            "Hold the block handle, then drag to move. Use the block menu to move without dragging.",
        },
      }}
    >
      <DraggableHandle editor={editor} id={id} enabled={enabled}>
        {children}
      </DraggableHandle>
      {drop &&
        createPortal(
          <div
            aria-hidden="true"
            className="better-editor-block-drop-indicator"
            style={{ left: drop.left, top: drop.top, width: drop.width }}
          />,
          document.body,
        )}
    </DndContext>
  );
}
