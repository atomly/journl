"use client";

import {
  blockAt,
  blockDragSelection,
  editBlocks,
  selectedBlock,
  selectedBlocks,
} from "@acme/tiptap";
import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { useIsMobile } from "@acme/ui/use-mobile";
import type { Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { GripVertical, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorHint, restoreEditorFocus } from "./controls";
import { BlockMenuContent } from "./toolbar";
import { TouchBlockDrag } from "./touch-block-drag";
import { useTiptapState } from "./writing-controls";

/** A handle selects the complete Journl wrapper, including descendants. Native
 * ProseMirror drag/drop owns moves; the identity adapter gives copies fresh IDs. */
export function TiptapSideMenu({
  editor,
  visible,
}: {
  editor: Editor;
  visible: boolean;
}) {
  const state = useTiptapState(editor);
  const compact = useIsMobile();
  const [touchPointer, setTouchPointer] = useState(false);
  const mobile = compact || touchPointer;
  const [id, setId] = useState<string>();
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [open, setOpen] = useState(false);
  const frozen = useRef(false);
  useEffect(() => {
    const root = editor.view.dom;
    const move = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && touchPointer) setTouchPointer(false);
      if (
        event.pointerType === "touch" ||
        open ||
        editor.view.dragging ||
        event.buttons
      )
        return;
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-tiptap-controls]")) return;
      const bounds = root.getBoundingClientRect();
      if (
        event.clientX < bounds.left - 64 ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        setId(undefined);
        return;
      }
      // Hit-test each block's own row, not the ancestor wrapper that also
      // encloses its descendants. This keeps a child's handle across its gutter.
      const row = [...root.querySelectorAll<HTMLElement>("[data-journl-body]")]
        .filter((body) => body.closest(".journl-tiptap") === root)
        .find((body) => {
          const rect = body.getBoundingClientRect();
          return (
            rect.height > 0 &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          );
        });
      if (row)
        setId(row.closest<HTMLElement>("[data-block-id]")?.dataset.blockId);
    };
    const focus = () => {
      if (open || frozen.current) return;
      const target = selectedBlock(editor.state);
      if (target) setId(target.id);
    };
    document.addEventListener("pointermove", move);
    editor.on("focus", focus);
    if (mobile) editor.on("selectionUpdate", focus);
    const tap = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !(event.target instanceof Element))
        return;
      setTouchPointer(true);
      const row = event.target.closest<HTMLElement>("[data-journl-body]");
      if (row?.closest(".journl-tiptap") === root)
        setId(row.closest<HTMLElement>("[data-block-id]")?.dataset.blockId);
    };
    root.addEventListener("pointerup", tap);
    return () => {
      document.removeEventListener("pointermove", move);
      editor.off("focus", focus);
      editor.off("selectionUpdate", focus);
      root.removeEventListener("pointerup", tap);
    };
  }, [editor, open, mobile, touchPointer]);
  useEffect(() => {
    if (!id) return;
    const update = () => {
      let position: ReturnType<typeof blockAt>;
      try {
        position = blockAt(state?.doc ?? editor.state.doc, id);
      } catch {
        setId(undefined);
        return;
      }
      const node = editor.view.nodeDOM(position.pos);
      if (!(node instanceof HTMLElement)) return;
      const body = node.querySelector<HTMLElement>("[data-journl-body]");
      const rect = (body ?? node).getBoundingClientRect();
      const padding = body
        ? Number.parseFloat(getComputedStyle(body).paddingTop) || 0
        : 0;
      setPosition({
        left: Math.max(4, rect.left - (mobile ? 48 : 64)),
        top:
          rect.top +
          padding +
          ((body ? Number.parseFloat(getComputedStyle(body).lineHeight) : 24) -
            (mobile ? 44 : 28)) /
            2,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [editor, id, state, mobile]);
  if (!id || (!visible && !open && !frozen.current)) return null;
  const select = (preserve = true) => {
    const target = blockAt(editor.state.doc, id);
    editor.view.dispatch(
      editor.state.tr.setSelection(
        preserve
          ? blockDragSelection(editor.state, id)
          : NodeSelection.create(editor.state.doc, target.pos),
      ),
    );
    const selected = selectedBlock(editor.state);
    if (!selected) throw new Error("Selected block is unavailable");
    return selected;
  };
  return (
    <TouchBlockDrag
      editor={editor}
      id={id}
      enabled={mobile}
      onActiveChange={(value) => {
        frozen.current = value;
      }}
      select={() => {
        select();
      }}
    >
      {(handle) =>
        createPortal(
          <div
            data-tiptap-controls=""
            data-tiptap-side-menu=""
            className="journl-side-menu"
            data-touch={mobile ? "true" : undefined}
            style={position}
          >
            {!mobile && (
              <EditorHint label="Add a block below">
                <Button
                  aria-label="Add block"
                  variant="ghost"
                  size="icon-sm"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const target = select(false);
                    const fresh = crypto.randomUUID();
                    const tr = editBlocks(
                      editor.state.tr,
                      [
                        {
                          afterId: target.id,
                          block: { content: "/", id: fresh, type: "paragraph" },
                          parentId: target.parentId,
                          type: "insert",
                        },
                      ],
                      fresh,
                    );
                    tr.setSelection(
                      TextSelection.create(
                        tr.doc,
                        blockAt(tr.doc, fresh).pos + 3,
                      ),
                    );
                    editor.view.focus();
                    editor.view.dispatch(tr.scrollIntoView());
                  }}
                >
                  <Plus />
                </Button>
              </EditorHint>
            )}
            <DropdownMenu
              modal={false}
              open={open}
              onOpenChange={(value) => {
                if (value) select();
                setOpen(value);
              }}
            >
              <DropdownMenuTrigger
                asChild
                onPointerDown={(event) => event.preventBaseUIHandler()}
                onMouseDown={(event) => {
                  // Opening on mousedown schedules focus into the menu during native
                  // dragstart. Keep the browser's drag gesture; open only on click.
                  event.preventBaseUIHandler();
                  select();
                }}
                onClick={(event) => {
                  event.preventBaseUIHandler();
                  if (!open) select();
                  setOpen(!open);
                }}
              >
                <EditorHint label="Drag to move">
                  <Button
                    aria-label="Block actions"
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-grab active:cursor-grabbing"
                    draggable={!touchPointer}
                    onPointerDown={(event) =>
                      setTouchPointer(event.pointerType === "touch")
                    }
                    ref={handle.setActivatorNodeRef}
                    {...(mobile ? handle.attributes : {})}
                    {...(mobile ? handle.listeners : {})}
                    onDragStart={(event) => {
                      const target = select();
                      const selection = editor.state.selection;
                      const slice = selection.content();
                      const { dom, text } =
                        editor.view.serializeForClipboard(slice);
                      event.dataTransfer.clearData();
                      event.dataTransfer.setData("text/html", dom.innerHTML);
                      event.dataTransfer.setData("text/plain", text);
                      event.dataTransfer.effectAllowed = "copyMove";
                      const element = editor.view.nodeDOM(target.pos);
                      if (element instanceof HTMLElement)
                        event.dataTransfer.setDragImage(element, 0, 0);
                      editor.view.dragging = { move: !event.altKey, slice };
                      setOpen(false);
                    }}
                    onDragEnd={() => {
                      editor.view.dragging = null;
                    }}
                  >
                    <GripVertical />
                  </Button>
                </EditorHint>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                data-tiptap-controls=""
                finalFocus={() => {
                  return restoreEditorFocus(editor);
                }}
              >
                <BlockMenuContent
                  editor={editor}
                  blockId={
                    selectedBlocks(editor.state).length > 1 ? undefined : id
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>,
          document.body,
        )
      }
    </TouchBlockDrag>
  );
}
