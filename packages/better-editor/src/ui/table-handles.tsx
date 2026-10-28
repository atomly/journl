"use client";

import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import {
  autoUpdate,
  hide,
  offset,
  type Placement,
  size,
  useFloating,
} from "@floating-ui/react";
import type { Editor } from "@tiptap/core";
import { closeHistory, undo } from "@tiptap/pm/history";
import { NodeSelection } from "@tiptap/pm/state";
import { cellAround } from "@tiptap/pm/tables";
import { GripHorizontal, GripVertical, Plus } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { blockAt } from "../engine/identity";
import { TABLE_EXTENSION_META } from "../engine/metadata";
import {
  applyTableEdit,
  canDropTableAxis,
  canMoveTableAxis,
  minimumTableSize,
  moveTableAxis,
  resizeTableAxis,
  type TableAxis,
  tableAxisSelection,
  tableContext,
} from "../engine/table-actions";
import { removeSelectedBlock } from "../engine/writing";
import {
  EditorHint,
  EditorMenuItem,
  isPointerClick,
  restoreEditorFocus,
} from "./controls";
import { TableMenuItems } from "./table-controls";
import { revealTableColumn } from "./table-reveal";
import { useTiptapState } from "./writing-controls";

type ActiveTable = {
  id: string;
  row: number;
  column: number;
  element: HTMLTableElement;
};
type Drag = { axis: TableAxis; from: number; to: number | null };

/** Resolve again at release, including the visible gutter of scrolled tables. */
function tableDropTarget(
  editor: Editor,
  active: ActiveTable,
  axis: TableAxis,
  from: number,
  x: number,
  y: number,
) {
  if (!active.element.isConnected) return null;
  const rect = active.element.getBoundingClientRect();
  const viewport =
    active.element.parentElement?.getBoundingClientRect() ?? rect;
  const left = Math.max(rect.left, viewport.left, 0);
  const right = Math.min(rect.right, viewport.right, window.innerWidth);
  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  if (
    right <= left ||
    bottom <= top ||
    x < left - 32 ||
    x > right + (axis === "row" ? 56 : 32) ||
    y < top - 32 ||
    y > bottom + 32
  )
    return null;
  const cell = document
    .elementFromPoint(
      Math.max(left + 2, Math.min(right - 2, x)),
      Math.max(top + 2, Math.min(bottom - 2, y)),
    )
    ?.closest("td,th");
  if (!cell || cell.closest("table") !== active.element) return null;
  const context = tableContext(editor.state, active.id);
  const pos = cellAround(
    editor.state.doc.resolve(editor.view.posAtDOM(cell, 0)),
  );
  if (!context || !pos) return null;
  const cellRect = context.map.findCell(pos.pos - context.start);
  const axisElements =
    axis === "row"
      ? active.element.rows
      : active.element.querySelector("colgroup")?.children;
  const coordinate =
    axis === "row"
      ? Math.max(top + 2, Math.min(bottom - 2, y))
      : Math.max(left + 2, Math.min(right - 2, x));
  const index = axisElements
    ? Array.from(axisElements).findIndex((element) => {
        const box = element.getBoundingClientRect();
        return axis === "row"
          ? coordinate >= box.top && coordinate < box.bottom
          : coordinate >= box.left && coordinate < box.right;
      })
    : -1;
  const target =
    index >= 0 ? index : axis === "row" ? cellRect.top : cellRect.left;
  return canDropTableAxis(context.table, axis, from, target) ? target : null;
}

/** One controller per editor. ProseMirror owns table data and selection;
 * Floating UI owns geometry/observers; this layer owns hover/menu gestures. */
export function TiptapTableHandles({
  editor,
  visible,
  renderMenu,
  renderHandle,
}: {
  editor: Editor;
  visible: boolean;
  renderMenu?: (target: {
    editor: Editor;
    axis: TableAxis;
    blockId: string;
  }) => React.ReactNode;
  renderHandle?: (axis: TableAxis) => React.ReactNode;
}) {
  const state = useTiptapState(editor);
  const [active, setActive] = useState<ActiveTable | null>(null);
  const [menu, setMenu] = useState<TableAxis | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [extending, setExtending] = useState<TableAxis | null>(null);
  const locked = Boolean(menu || drag || extending);
  const hasActive = active !== null;
  useEffect(() => {
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (locked || event.buttons || !(event.target instanceof Element)) return;
      if (
        event.target.closest("[data-tiptap-controls]") &&
        !event.target.closest("[data-table-extend]")
      )
        return;
      const target = event.target;
      const x = event.clientX;
      const y = event.clientY;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const table = target.closest<HTMLTableElement>("table");
        const wrapper = table?.closest<HTMLElement>("[data-block-id]");
        const id = wrapper?.dataset.blockId;
        if (
          table &&
          id &&
          table.closest(".better-editor-tiptap") === editor.view.dom
        ) {
          const context = tableContext(editor.state, id);
          const cell = target.closest("td,th");
          const position =
            cell &&
            cellAround(editor.state.doc.resolve(editor.view.posAtDOM(cell, 0)));
          if (context && position) {
            const rect = context.map.findCell(position.pos - context.start);
            setActive((previous) =>
              previous?.id === id &&
              previous.row === rect.top &&
              previous.column === rect.left
                ? previous
                : { column: rect.left, element: table, id, row: rect.top },
            );
            return;
          }
        }
        setActive((previous) => {
          if (!previous?.element.isConnected) return null;
          const rect = previous.element.getBoundingClientRect();
          if (
            x < rect.left - 32 ||
            x > rect.right + 28 ||
            y < rect.top - 32 ||
            y > rect.bottom + 28
          )
            return null;
          const context = tableContext(editor.state, previous.id);
          if (!context) return null;
          const row = y >= rect.bottom ? context.map.height - 1 : previous.row;
          const column =
            x >= rect.right ? context.map.width - 1 : previous.column;
          return row === previous.row && column === previous.column
            ? previous
            : { ...previous, column, row };
        });
      });
    };
    const selection = () => {
      if (locked || !editor.isFocused) return;
      const pos = cellAround(editor.state.selection.$from);
      if (!pos) return;
      const cell = editor.view.nodeDOM(pos.pos);
      if (!(cell instanceof HTMLElement)) return;
      const table = cell.closest("table");
      const id =
        table?.closest<HTMLElement>("[data-block-id]")?.dataset.blockId;
      const context = id && tableContext(editor.state, id);
      if (!table || !context) return;
      const rect = context.map.findCell(pos.pos - context.start);
      setActive((previous) =>
        previous?.id === context.id &&
        previous.row === rect.top &&
        previous.column === rect.left
          ? previous
          : {
              column: rect.left,
              element: table,
              id: context.id,
              row: rect.top,
            },
      );
    };
    const outside = (event: PointerEvent) => {
      if (
        !locked &&
        event.target instanceof Element &&
        !editor.view.dom.contains(event.target) &&
        !event.target.closest("[data-tiptap-controls]")
      )
        setActive(null);
    };
    editor.on("selectionUpdate", selection);
    editor.on("focus", selection);
    const pointerSurface = hasActive ? document : editor.view.dom;
    if (hasActive) document.addEventListener("pointerdown", outside);
    pointerSurface.addEventListener("pointermove", move as EventListener);
    return () => {
      editor.off("selectionUpdate", selection);
      editor.off("focus", selection);
      document.removeEventListener("pointerdown", outside);
      pointerSurface.removeEventListener("pointermove", move as EventListener);
      cancelAnimationFrame(frame);
    };
  }, [editor, locked, hasActive]);
  useEffect(() => {
    if (!active || !drag) return;
    const over = (event: DragEvent) => {
      const to = tableDropTarget(
        editor,
        active,
        drag.axis,
        drag.from,
        event.clientX,
        event.clientY,
      );
      if (to !== null) event.preventDefault();
      if (event.dataTransfer)
        event.dataTransfer.dropEffect = to === null ? "none" : "move";
      setDrag((previous) =>
        previous?.to === to ? previous : previous && { ...previous, to },
      );
    };
    const drop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const to = tableDropTarget(
        editor,
        active,
        drag.axis,
        drag.from,
        event.clientX,
        event.clientY,
      );
      const tr =
        to === null
          ? null
          : moveTableAxis(editor.state, active.id, drag.axis, drag.from, to);
      if (tr) applyTableEdit(editor, tr.scrollIntoView());
      setDrag(null);
      editor.view.focus();
    };
    document.addEventListener("dragover", over);
    document.addEventListener("drop", drop, true);
    return () => {
      document.removeEventListener("dragover", over);
      document.removeEventListener("drop", drop, true);
    };
  }, [active, drag, editor]);
  useEffect(() => {
    if (!active || !state) return;
    const context = tableContext(state, active.id);
    const wrapper =
      context && editor.view.nodeDOM(blockAt(state.doc, active.id).pos);
    if (
      active.element.isConnected &&
      wrapper instanceof HTMLElement &&
      wrapper.querySelector("table") === active.element
    )
      return;
    setActive(null);
    setMenu(null);
    setDrag(null);
    setExtending(null);
  }, [active, editor, state]);
  const context = active && state ? tableContext(state, active.id) : null;
  if (
    (!visible && !locked) ||
    !active ||
    !context ||
    !active.element.isConnected
  )
    return null;
  const { map, table, start } = context;
  const row = Math.min(active.row, map.height - 1);
  const column = Math.min(active.column, map.width - 1);
  const cellPosition = map.map[row * map.width + column];
  if (cellPosition === undefined) return null;
  const cellRect = map.findCell(cellPosition);
  const cell = editor.view.nodeDOM(start + cellPosition);
  if (!(cell instanceof HTMLElement)) return null;
  const select = (axis: TableAxis, index: number) => {
    const selection = tableAxisSelection(editor.state, active.id, axis, index);
    if (selection)
      editor.view.dispatch(editor.state.tr.setSelection(selection));
  };
  return createPortal(
    <div
      data-tiptap-controls=""
      data-tiptap-owner={editor.instanceId}
      data-tiptap-table-controls=""
    >
      {(["row", "column"] as const).map((axis) => (
        <TableAxisHandle
          key={axis}
          editor={editor}
          axis={axis}
          index={axis === "row" ? row : column}
          active={active}
          renderMenu={renderMenu}
          renderHandle={renderHandle}
          cell={cell}
          open={menu === axis}
          hidden={
            Boolean((drag && drag.axis !== axis) || extending) ||
            Boolean(menu && menu !== axis)
          }
          onOpenChange={(open) => {
            if (open) select(axis, axis === "row" ? row : column);
            setMenu(open ? axis : null);
          }}
          draggable={canMoveTableAxis(
            table,
            axis,
            axis === "row" ? row : column,
          )}
          onDragStart={() => {
            const from = axis === "row" ? row : column;
            select(axis, from);
            setMenu(null);
            setDrag({ axis, from, to: from });
          }}
          onDragEnd={() => setDrag(null)}
        />
      ))}
      {(["row", "column"] as const).map((axis) => (
        <TableExtendRail
          key={axis}
          editor={editor}
          active={active}
          axis={axis}
          show={
            !menu &&
            !drag &&
            (!extending || extending === axis) &&
            (extending === axis ||
              (axis === "row"
                ? cellRect.bottom === map.height
                : cellRect.right === map.width))
          }
          extending={extending === axis}
          onExtending={setExtending}
        />
      ))}
      {drag && drag.to !== null && (
        <TableDropIndicator editor={editor} active={active} drag={drag} />
      )}
    </div>,
    document.body,
  );
}

function useTablePosition(
  table: HTMLTableElement,
  cell: HTMLElement,
  placement: Placement,
  rail?: TableAxis,
) {
  const reference = useCallback(() => {
    const rect = table.getBoundingClientRect();
    const viewport = table.parentElement?.getBoundingClientRect() ?? rect;
    const left = Math.max(rect.left, viewport.left);
    const right = Math.min(rect.right, viewport.right);
    const box = cell.getBoundingClientRect();
    if (rail)
      return new DOMRect(
        left,
        rect.top,
        Math.max(0, right - left),
        rect.height,
      );
    return placement === "right"
      ? new DOMRect(left, box.top, Math.max(0, right - left), box.height)
      : new DOMRect(box.left, rect.top, box.width, rect.height);
  }, [table, cell, placement, rail]);
  const floating = useFloating({
    middleware: [
      // The whole-block menu occupies the left gutter. Row controls use the
      // right gutter, outside the 20px column-extension rail plus a small gap.
      offset(!rail && placement === "right" ? 24 : 2),
      size({
        apply({ elements }) {
          if (!rail) return;
          const rect = reference();
          Object.assign(
            elements.floating.style,
            rail === "row"
              ? { width: `${rect.width}px` }
              : { height: `${rect.height}px` },
          );
        },
      }),
      {
        fn() {
          const rect = table.getBoundingClientRect();
          const viewport = table.parentElement?.getBoundingClientRect() ?? rect;
          return { data: { rightClipped: rect.right > viewport.right + 1 } };
        },
        name: "tableViewport",
      },
      hide({ strategy: "referenceHidden" }),
      hide({ boundary: [], rootBoundary: "viewport", strategy: "escaped" }),
    ],
    placement,
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => {
    floating.refs.setPositionReference({
      contextElement: table,
      getBoundingClientRect: reference,
    });
  }, [floating.refs, table, reference]);
  return {
    ...floating,
    clipped: Boolean(
      floating.middlewareData.hide?.referenceHidden ||
        floating.middlewareData.hide?.escaped ||
        (rail === "column" &&
          floating.middlewareData.tableViewport?.rightClipped),
    ),
  };
}

function TableAxisHandle({
  editor,
  axis,
  index,
  active,
  cell,
  open,
  hidden,
  onOpenChange,
  draggable,
  onDragStart,
  onDragEnd,
  renderMenu,
  renderHandle,
}: {
  editor: Editor;
  axis: TableAxis;
  index: number;
  active: ActiveTable;
  cell: HTMLElement;
  open: boolean;
  hidden: boolean;
  onOpenChange: (open: boolean) => void;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  renderMenu?: (target: {
    editor: Editor;
    axis: TableAxis;
    blockId: string;
  }) => React.ReactNode;
  renderHandle?: (axis: TableAxis) => React.ReactNode;
}) {
  const dragging = useRef(false);
  const consumedClick = useRef(false);
  const dragClosedMenu = useRef(false);
  const { refs, floatingStyles, clipped } = useTablePosition(
    active.element,
    cell,
    axis === "row" ? "right" : "top",
  );
  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(value, details) => {
        if (value && (dragging.current || consumedClick.current)) {
          details.cancel();
          return;
        }
        if (value) dragClosedMenu.current = false;
        onOpenChange(value);
      }}
    >
      <DropdownMenuTrigger
        asChild
        onPointerDown={(event) => {
          event.preventBaseUIHandler();
          if (!dragging.current) consumedClick.current = false;
        }}
        onKeyDown={() => {
          if (!dragging.current) consumedClick.current = false;
        }}
        onMouseDown={(event) => event.preventBaseUIHandler()}
        onClick={(event) => {
          event.preventBaseUIHandler();
          if (
            dragging.current ||
            (consumedClick.current && isPointerClick(event))
          )
            return;
          if (!isPointerClick(event)) consumedClick.current = false;
          dragClosedMenu.current = false;
          onOpenChange(!open);
        }}
      >
        <EditorHint label={axis === "row" ? "Row actions" : "Column actions"}>
          <Button
            ref={refs.setFloating}
            aria-label={`${axis === "row" ? "Row" : "Column"} actions`}
            variant="ghost"
            size="icon-sm"
            data-table-handle={axis}
            data-table-index={index}
            className="better-editor-table-handle"
            style={{
              ...floatingStyles,
              visibility: hidden || clipped ? "hidden" : undefined,
            }}
            draggable={draggable}
            onMouseDown={() => {
              const selection = tableAxisSelection(
                editor.state,
                active.id,
                axis,
                index,
              );
              if (selection)
                editor.view.dispatch(editor.state.tr.setSelection(selection));
            }}
            onDragStart={(event) => {
              dragging.current = true;
              consumedClick.current = true;
              dragClosedMenu.current = true;
              event.dataTransfer.setData(
                "application/x-better-editor-table-axis",
                axis,
              );
              event.dataTransfer.effectAllowed = "move";
              onDragStart();
            }}
            onDragEnd={() => {
              dragging.current = false;
              onDragEnd();
            }}
          >
            {renderHandle?.(axis) ??
              (axis === "row" ? <GripVertical /> : <GripHorizontal />)}
          </Button>
        </EditorHint>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-tiptap-controls=""
        data-tiptap-owner={editor.instanceId}
        finalFocus={() => {
          return dragClosedMenu.current ? false : restoreEditorFocus(editor);
        }}
      >
        {renderMenu ? (
          renderMenu({ axis, blockId: active.id, editor })
        ) : (
          <>
            <TableMenuItems editor={editor} axis={axis} />
            <DropdownMenuSeparator />
            <EditorMenuItem
              hint="Remove the whole table"
              variant="destructive"
              onClick={() => {
                const block = blockAt(editor.state.doc, active.id);
                editor.view.dispatch(
                  editor.state.tr.setSelection(
                    NodeSelection.create(editor.state.doc, block.pos),
                  ),
                );
                const tr = removeSelectedBlock(editor.state, () =>
                  crypto.randomUUID(),
                );
                if (tr) applyTableEdit(editor, tr);
                editor.view.focus();
              }}
            >
              Delete table
            </EditorMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TableExtendRail({
  editor,
  active,
  axis,
  show,
  onExtending,
  extending,
}: {
  editor: Editor;
  active: ActiveTable;
  axis: TableAxis;
  show: boolean;
  extending: boolean;
  onExtending: (value: TableAxis | null) => void;
}) {
  const { refs, floatingStyles, clipped } = useTablePosition(
    active.element,
    active.element,
    axis === "row" ? "bottom" : "right",
    axis,
  );
  const gesture = useRef<{
    origin: number;
    count: number;
    min: number;
    step: number;
    time: number;
    changed: boolean;
    target: HTMLElement;
    pointerId: number;
  } | null>(null);
  const end = useCallback(
    (cancel = false) => {
      const current = gesture.current;
      if (!current) return;
      gesture.current = null;
      if (current.target.hasPointerCapture(current.pointerId))
        current.target.releasePointerCapture(current.pointerId);
      onExtending(null);
      if (editor.isDestroyed) return;
      if (cancel && current.changed) undo(editor.state, editor.view.dispatch);
      editor.view.dispatch(closeHistory(editor.state.tr));
      editor.view.focus();
    },
    [editor, onExtending],
  );
  useEffect(() => {
    if (!extending) return;
    const cancelWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      end(true);
    };
    // Undo, deletion, or a document replacement ends the gesture without undoing
    // that independent edit. Only transactions from this gesture may continue it.
    const transaction = ({
      transaction,
    }: {
      transaction: import("@tiptap/pm/state").Transaction;
    }) => {
      if (
        (transaction.docChanged || transaction.selectionSet) &&
        transaction.getMeta(TABLE_EXTENSION_META) !== gesture.current?.time
      )
        end();
    };
    const cancelWithAnotherPointer = (event: PointerEvent) => {
      const current = gesture.current;
      if (current && event.pointerId !== current.pointerId) end(true);
    };
    document.addEventListener("pointerdown", cancelWithAnotherPointer, true);
    document.addEventListener("keydown", cancelWithEscape, true);
    editor.on("transaction", transaction);
    return () => {
      document.removeEventListener(
        "pointerdown",
        cancelWithAnotherPointer,
        true,
      );
      document.removeEventListener("keydown", cancelWithEscape, true);
      editor.off("transaction", transaction);
      end();
    };
  }, [editor, end, extending]);
  return (
    <EditorHint label={axis === "row" ? "Add row" : "Add column"}>
      <Button
        ref={refs.setFloating}
        aria-label={axis === "row" ? "Add row" : "Add column"}
        variant="ghost"
        className={`better-editor-table-extend better-editor-table-extend-${axis}`}
        data-table-extend={axis}
        style={{
          ...floatingStyles,
          visibility: show && !clipped ? undefined : "hidden",
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const current = gesture.current;
          if (!event.isPrimary || current) {
            event.preventDefault();
            if (current && event.pointerId !== current.pointerId) end(true);
            return;
          }
          const context = tableContext(editor.state, active.id);
          if (!context) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          const count = axis === "row" ? context.map.height : context.map.width;
          editor.view.dispatch(closeHistory(editor.state.tr));
          gesture.current = {
            changed: false,
            count,
            min: minimumTableSize(context.table, axis),
            origin: axis === "row" ? event.clientY : event.clientX,
            pointerId: event.pointerId,
            step:
              axis === "row"
                ? active.element.getBoundingClientRect().height / count
                : 120,
            target: event.currentTarget,
            time: Date.now(),
          };
          onExtending(axis);
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (!current || event.pointerId !== current.pointerId) return;
          const delta =
            (axis === "row" ? event.clientY : event.clientX) - current.origin;
          const count = Math.max(
            current.min,
            current.count + Math.round(delta / current.step),
          );
          const tr = resizeTableAxis(editor.state, active.id, axis, count);
          if (tr) {
            current.changed = true;
            editor.view.dispatch(
              tr
                .setTime(current.time)
                .setMeta(TABLE_EXTENSION_META, current.time),
            );
            if (axis === "column" && count > current.count)
              revealTableColumn(editor, active.id, count - 1);
          }
        }}
        onPointerUp={(event) => {
          const current = gesture.current;
          if (!current || event.pointerId !== current.pointerId) return;
          if (!current.changed) {
            const tr = resizeTableAxis(
              editor.state,
              active.id,
              axis,
              current.count + 1,
            );
            if (tr) {
              editor.view.dispatch(
                tr
                  .setTime(current.time)
                  .setMeta(TABLE_EXTENSION_META, current.time),
              );
              if (axis === "column")
                revealTableColumn(editor, active.id, current.count);
            }
          }
          end();
        }}
        onPointerCancel={(event) => {
          if (event.pointerId === gesture.current?.pointerId) end(true);
        }}
        onLostPointerCapture={(event) => {
          if (event.pointerId === gesture.current?.pointerId) end(true);
        }}
        onClick={(event) => {
          if (!isPointerClick(event)) {
            const context = tableContext(editor.state, active.id);
            if (context) {
              const count =
                axis === "row" ? context.map.height : context.map.width;
              const tr = resizeTableAxis(
                editor.state,
                active.id,
                axis,
                count + 1,
              );
              if (tr) {
                applyTableEdit(editor, tr);
                if (axis === "column")
                  revealTableColumn(editor, active.id, count);
              }
            }
            editor.view.focus();
          }
        }}
      >
        <Plus />
      </Button>
    </EditorHint>
  );
}

function TableDropIndicator({
  editor,
  active,
  drag,
}: {
  editor: Editor;
  active: ActiveTable;
  drag: Drag;
}) {
  const context = tableContext(editor.state, active.id);
  if (!context || drag.to === null) return null;
  const index = drag.axis === "row" ? drag.to * context.map.width : drag.to;
  const cell = editor.view.nodeDOM(
    context.start + (context.map.map[index] ?? 0),
  );
  if (!(cell instanceof HTMLElement)) return null;
  const table = active.element.getBoundingClientRect();
  const rect = cell.getBoundingClientRect();
  const style: CSSProperties =
    drag.axis === "row"
      ? {
          height: 2,
          left: table.left,
          top: drag.to > drag.from ? rect.bottom : rect.top,
          width: table.width,
        }
      : {
          height: table.height,
          left: drag.to > drag.from ? rect.right : rect.left,
          top: table.top,
          width: 2,
        };
  return <div className="better-editor-table-drop-indicator" style={style} />;
}
