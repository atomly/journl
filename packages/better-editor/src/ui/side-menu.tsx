"use client";

import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { useIsMobile } from "@acme/ui/use-mobile";
import {
  autoUpdate,
  hide,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
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
import { EditorHint, isPointerClick, restoreEditorFocus } from "./controls";
import { inToolbarCorridor } from "./pointer-corridor";
import { BlockMenuContent } from "./toolbar";
import { BLOCK_DRAG_DISTANCE, TouchBlockDrag } from "./touch-block-drag";
import { useTiptapState } from "./writing-controls";

/** A handle selects the complete BetterEditor wrapper, including descendants. Native
 * ProseMirror drag/drop owns moves; the identity adapter gives copies fresh IDs. */
export function TiptapSideMenu({
  editor,
  visible,
  renderMenu,
  renderHandle,
}: {
  editor: Editor;
  visible: boolean;
  renderMenu?: (target: {
    editor: Editor;
    blockId?: string;
  }) => React.ReactNode;
  renderHandle?: React.ReactNode;
}) {
  const state = useTiptapState(editor);
  const compact = useIsMobile();
  const [touchPointer, setTouchPointer] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches,
  );
  const touchOwner = useRef(touchPointer);
  const consumedClick = useRef(false);
  const pressPoint = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  );
  const dragClosedMenu = useRef(false);
  const mobile = compact || touchPointer;
  const [id, setIdState] = useState<string>();
  const activeId = useRef<string | undefined>(undefined);
  const setId = useCallback((value: string | undefined) => {
    // Pointer events can cross the gap before React paints the next handle.
    activeId.current = value;
    setIdState(value);
  }, []);
  const floating = useFloating({
    middleware: [
      offset(4),
      shift({
        altBoundary: mobile,
        crossAxis: true,
        // For left placement, the main axis is vertical. Never move the rail
        // away from its block to fit above a mobile keyboard.
        mainAxis: false,
        padding: 4,
      }),
      hide({ strategy: "referenceHidden" }),
    ],
    placement: "left-start",
    strategy: "fixed",
    // Coalesce observed layout changes outside ResizeObserver delivery. There
    // is no frame loop when geometry is idle.
    whileElementsMounted: (reference, floating, update) => {
      let frame: number | undefined;
      const cleanup = autoUpdate(reference, floating, () => {
        if (frame !== undefined) return;
        frame = requestAnimationFrame(() => {
          frame = undefined;
          update();
        });
      });
      return () => {
        cleanup();
        if (frame !== undefined) cancelAnimationFrame(frame);
      };
    },
  });
  const [open, setOpen] = useState(false);
  const frozen = useRef(false);
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    const owner = pressPoint.current?.pointerId;
    if (!pressed || owner === undefined) return;
    const release = (event: PointerEvent) => {
      if (event.pointerId !== owner || pressPoint.current?.pointerId !== owner)
        return;
      pressPoint.current = null;
      consumedClick.current = true;
      setPressed(false);
    };
    // Bubble after the trigger's intentional release action. Other pointers
    // must not clear this press or consume its termination listener.
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);
    return () => {
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
    };
  }, [pressed]);
  useEffect(() => {
    const root = editor.view.dom;
    const move = (event: PointerEvent) => {
      if (
        event.pointerType === "mouse" &&
        touchPointer &&
        !pressed &&
        !frozen.current
      )
        setTouchPointer(false);
      if (
        touchPointer ||
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
          ?.querySelector<HTMLElement>("[data-better-editor-body]");
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
        if (!mobile) setId(undefined);
        return;
      }
      // Hit-test each block's own row, not the ancestor wrapper that also
      // encloses its descendants. This keeps a child's handle across its gutter.
      const row = [
        ...root.querySelectorAll<HTMLElement>("[data-better-editor-body]"),
      ]
        .filter((body) => body.closest(".better-editor-tiptap") === root)
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
    editor.on("selectionUpdate", focus);
    const tap = (event: PointerEvent) => {
      if (
        event.pointerType !== "touch" ||
        !(event.target instanceof Element) ||
        open ||
        pressed ||
        frozen.current ||
        editor.view.dragging
      )
        return;
      setTouchPointer(true);
      const row = event.target.closest<HTMLElement>(
        "[data-better-editor-body]",
      );
      if (row?.closest(".better-editor-tiptap") === root)
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
    let target: ReturnType<typeof blockAt>;
    try {
      target = blockAt(state?.doc ?? editor.state.doc, id);
    } catch {
      setId(undefined);
      return;
    }
    const node = editor.view.nodeDOM(target.pos);
    if (!(node instanceof HTMLElement)) return;
    const body =
      node.querySelector<HTMLElement>("[data-better-editor-body]") ?? node;
    floating.refs.setPositionReference({
      contextElement: node,
      getBoundingClientRect() {
        const rect = body.getBoundingClientRect();
        const line =
          body.dataset.betterEditorBody === "codeBlock"
            ? (body.querySelector("pre") ?? body)
            : body;
        const style = getComputedStyle(line);
        const padding = Number.parseFloat(style.paddingTop) || 0;
        const lineHeight = Number.parseFloat(style.lineHeight) || 24;
        const handleHeight = mobile ? 44 : 28;
        // Nested touch controls stay in the outer gutter so their 44px targets
        // cannot cover text in the following, less-indented row.
        const left = mobile
          ? editor.view.dom.getBoundingClientRect().left +
            (Number.parseFloat(getComputedStyle(editor.view.dom).paddingLeft) ||
              0)
          : (body
              .closest(".better-editor-table-wrapper")
              ?.getBoundingClientRect().left ?? rect.left);
        return new DOMRect(
          left,
          line.getBoundingClientRect().top +
            padding +
            (lineHeight - handleHeight) / 2 -
            2,
          rect.width,
          mobile ? Math.max(handleHeight, rect.height) : handleHeight,
        );
      },
    });
  }, [editor, id, state, mobile, setId, floating.refs]);
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
  const toggleMenu = () => {
    if (!open) {
      dragClosedMenu.current = false;
      select();
    }
    setOpen(!open);
  };
  const addBlock = (
    <EditorHint label="Add a block below">
      <Button
        aria-label="Add block"
        variant="ghost"
        size="icon-sm"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          const target = select(false);
          const body = target.node.firstChild;
          const reuse = body?.type.name === "paragraph" && !body.content.size;
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
            TextSelection.create(tr.doc, blockAt(tr.doc, fresh).pos + 2),
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
  );
  return (
    <TouchBlockDrag
      editor={editor}
      id={id}
      onActiveChange={(value) => {
        frozen.current = value;
        if (value) {
          consumedClick.current = true;
          dragClosedMenu.current = true;
          setOpen(false);
        } else setPressed(false);
      }}
      select={() => {
        select();
      }}
    >
      {(handle) =>
        createPortal(
          <div
            data-tiptap-controls=""
            data-tiptap-owner={editor.instanceId}
            data-tiptap-side-menu=""
            className="better-editor-side-menu"
            data-touch={mobile ? "true" : undefined}
            ref={floating.refs.setFloating}
            style={{
              ...floating.floatingStyles,
              visibility: floating.middlewareData.hide?.referenceHidden
                ? "hidden"
                : undefined,
            }}
          >
            {!mobile && addBlock}
            <DropdownMenu
              modal={false}
              open={open}
              onOpenChange={(value, details) => {
                if (value && (frozen.current || consumedClick.current)) {
                  details.cancel();
                  return;
                }
                if (value) {
                  dragClosedMenu.current = false;
                  select();
                }
                setOpen(value);
              }}
            >
              <DropdownMenuTrigger
                asChild
                onPointerDown={(event) => {
                  event.preventBaseUIHandler();
                  if (
                    event.button !== 0 ||
                    !event.isPrimary ||
                    pressPoint.current ||
                    frozen.current ||
                    editor.view.dragging
                  )
                    return;
                  pressPoint.current = {
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                  };
                  consumedClick.current = false;
                  touchOwner.current = event.pointerType === "touch";
                  setPressed(true);
                }}
                onPointerUp={(event) => {
                  event.preventBaseUIHandler();
                  const start = pressPoint.current;
                  if (
                    !start ||
                    start.pointerId !== event.pointerId ||
                    event.button !== 0
                  )
                    return;
                  pressPoint.current = null;
                  setPressed(false);
                  const moved =
                    Math.hypot(
                      event.clientX - start.x,
                      event.clientY - start.y,
                    ) > BLOCK_DRAG_DISTANCE;
                  const tap =
                    !moved && !frozen.current && !consumedClick.current;
                  // Pointer taps and click-only accessibility activation are distinct.
                  // Opening on release avoids dnd-kit's trailing-click suppression.
                  consumedClick.current = true;
                  if (tap) toggleMenu();
                }}
                onPointerCancel={(event) => {
                  if (pressPoint.current?.pointerId !== event.pointerId) return;
                  pressPoint.current = null;
                  consumedClick.current = true;
                  setPressed(false);
                }}
                onKeyDown={() => {
                  if (!frozen.current) consumedClick.current = false;
                }}
                onMouseDown={(event) => {
                  // Opening on mousedown schedules focus into the menu during native
                  // dragstart. Keep the browser's drag gesture; open only on click.
                  event.preventBaseUIHandler();
                  if (touchOwner.current) event.preventDefault();
                  else select();
                }}
                onClick={(event) => {
                  event.preventBaseUIHandler();
                  if (
                    frozen.current ||
                    (consumedClick.current && isPointerClick(event))
                  ) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }
                  if (!isPointerClick(event)) consumedClick.current = false;
                  toggleMenu();
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
                    {...handle.attributes}
                    {...handle.listeners}
                    onDragStart={(event) => {
                      // A cancelled native start must not leave a clipboard slice
                      // behind while dnd-kit owns this touch gesture.
                      if (touchOwner.current || frozen.current) {
                        event.preventDefault();
                        return;
                      }
                      consumedClick.current = true;
                      dragClosedMenu.current = true;
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
                        ...(selection instanceof NodeSelection
                          ? { node: selection }
                          : {}),
                      };
                      setOpen(false);
                    }}
                    onDragEnd={() => {
                      editor.view.dragging = null;
                    }}
                  >
                    {renderHandle ?? <GripVertical />}
                  </Button>
                </EditorHint>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                data-tiptap-controls=""
                data-tiptap-owner={editor.instanceId}
                finalFocus={() => {
                  return dragClosedMenu.current
                    ? false
                    : restoreEditorFocus(editor);
                }}
              >
                {renderMenu ? (
                  renderMenu({
                    blockId:
                      selectedBlocks(editor.state).length > 1 ? undefined : id,
                    editor,
                  })
                ) : (
                  <BlockMenuContent
                    editor={editor}
                    blockId={
                      selectedBlocks(editor.state).length > 1 ? undefined : id
                    }
                  />
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>,
          document.body,
        )
      }
    </TouchBlockDrag>
  );
}
