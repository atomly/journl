"use client";

import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { useIsMobile } from "@acme/ui/use-mobile";
import { type Editor, isMacOS } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { GripVertical, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  blockDragSelection,
  editBlocks,
  selectedBlock,
  selectedBlocks,
} from "../engine/commands";
import { blockAt } from "../engine/identity";
import { slashKey } from "../engine/suggestions";
import { EditorHint, restoreEditorFocus } from "./controls";
import { inToolbarCorridor } from "./pointer-corridor";
import { BlockMenuContent } from "./toolbar";
import { TouchBlockDrag } from "./touch-block-drag";
import { useTiptapState } from "./writing-controls";

/** A handle selects the complete OpenEditor wrapper, including descendants. Native
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
  const [id, setIdState] = useState<string>();
  const activeId = useRef<string | undefined>(undefined);
  const setId = useCallback((value: string | undefined) => {
    // Pointer events can cross the gap before React paints the next handle.
    activeId.current = value;
    setIdState(value);
  }, []);
  const [position, setPosition] = useState({ color: "", left: 0, top: 0 });
  const [open, setOpen] = useState(false);
  const frozen = useRef(false);
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    if (!pressed) return;
    const release = () => requestAnimationFrame(() => setPressed(false));
    document.addEventListener("pointerup", release, { once: true });
    document.addEventListener("pointercancel", release, { once: true });
    return () => {
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
    };
  }, [pressed]);
  useEffect(() => {
    const root = editor.view.dom;
    const move = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && touchPointer) setTouchPointer(false);
      if (
        event.pointerType === "touch" ||
        open ||
        pressed ||
        frozen.current ||
        editor.view.dragging ||
        event.buttons
      )
        return;
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-tiptap-controls]")) return;
      const currentId = activeId.current;
      if (currentId) {
        const toolbar = document.querySelector<HTMLElement>(
          `[data-tiptap-toolbar="selection"][data-tiptap-owner="${editor.instanceId}"]`,
        );
        const block = [...root.querySelectorAll<HTMLElement>("[data-block-id]")]
          .find((element) => element.dataset.blockId === currentId)
          ?.querySelector<HTMLElement>("[data-open-editor-body]");
        if (
          toolbar &&
          block &&
          inToolbarCorridor(
            event.clientX,
            event.clientY,
            block.getBoundingClientRect(),
            toolbar.getBoundingClientRect(),
          )
        )
          return;
      }
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
      const row = [
        ...root.querySelectorAll<HTMLElement>("[data-open-editor-body]"),
      ]
        .filter((body) => body.closest(".open-editor-tiptap") === root)
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
      if (open || pressed || frozen.current) return;
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
      const row = event.target.closest<HTMLElement>("[data-open-editor-body]");
      if (row?.closest(".open-editor-tiptap") === root)
        setId(row.closest<HTMLElement>("[data-block-id]")?.dataset.blockId);
    };
    root.addEventListener("pointerup", tap);
    return () => {
      document.removeEventListener("pointermove", move);
      editor.off("focus", focus);
      editor.off("selectionUpdate", focus);
      root.removeEventListener("pointerup", tap);
    };
  }, [editor, open, pressed, mobile, touchPointer, setId]);
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
      const body = node.querySelector<HTMLElement>("[data-open-editor-body]");
      const rect = (body ?? node).getBoundingClientRect();
      const padding = body
        ? Number.parseFloat(getComputedStyle(body).paddingTop) || 0
        : 0;
      setPosition({
        color: getComputedStyle(editor.view.dom).color,
        left: Math.max(4, rect.left - (mobile ? 48 : 64)),
        top:
          rect.top +
          padding +
          ((body ? Number.parseFloat(getComputedStyle(body).lineHeight) : 24) -
            (mobile ? 48 : 32)) /
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
  }, [editor, id, state, mobile, setId]);
  if (
    !id ||
    (!visible && !open && !pressed && !frozen.current && !editor.view.dragging)
  )
    return null;
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
            className="open-editor-side-menu"
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
                    const body = target.node.firstChild;
                    const reuse =
                      body?.type.name === "paragraph" && !body.content.size;
                    const fresh = reuse ? target.id : crypto.randomUUID();
                    const tr = reuse
                      ? editor.state.tr
                      : editBlocks(
                          editor.state.tr,
                          [
                            {
                              afterId: target.id,
                              block: { id: fresh, type: "paragraph" },
                              parentId: target.parentId,
                              type: "insert",
                            },
                          ],
                          fresh,
                        );
                    tr.setSelection(
                      TextSelection.create(
                        tr.doc,
                        blockAt(tr.doc, fresh).pos + 2,
                      ),
                    );
                    editor.view.focus();
                    editor.view.dispatch(
                      tr.setMeta(slashKey, { open: true }).scrollIntoView(),
                    );
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
                onPointerDown={(event) => {
                  event.preventBaseUIHandler();
                  setPressed(true);
                }}
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
                      editor.view.dragging = {
                        move: !(isMacOS() ? event.altKey : event.ctrlKey),
                        slice,
                      };
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
