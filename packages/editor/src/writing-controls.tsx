"use client";

import {
  applySlashChoice,
  blockAt,
  duplicateSelectedBlock,
  filteredBlockChoices,
  indentBlock,
  moveSelectedBlock,
  removeSelectedBlock,
  selectedBlock,
  slashKey,
} from "@acme/tiptap";
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
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { EditorHint, EditorMenuItem, restoreEditorFocus } from "./controls";

const subscribeEmpty = () => () => {};
const getEmpty = () => null;
export function useTiptapState(editor?: Editor) {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!editor) return () => {};
      editor.on("transaction", notify);
      return () => {
        editor.off("transaction", notify);
      };
    },
    [editor],
  );
  const getSnapshot = useCallback(() => editor?.state ?? null, [editor]);
  return useSyncExternalStore(
    editor ? subscribe : subscribeEmpty,
    getSnapshot,
    getEmpty,
  );
}

export function BlockActions({
  editor,
  blockId,
}: {
  editor: Editor;
  blockId?: string;
}) {
  const current = useTiptapState(editor) ?? editor.state;
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
        hint="Indent the selected blocks together (Tab or ⌘/Ctrl+])"
        disabled={!indentBlock(state)}
        onClick={() => execute((state) => indentBlock(state))}
      >
        Indent
      </EditorMenuItem>
      <EditorMenuItem
        hint="Outdent the selected blocks together (Shift+Tab or ⌘/Ctrl+[)"
        disabled={!indentBlock(state, true)}
        onClick={() => execute((state) => indentBlock(state, true))}
      >
        Outdent
      </EditorMenuItem>
      <DropdownMenuSeparator />
      <EditorMenuItem
        hint="Duplicate this block and everything nested inside it (⌘/Ctrl+D)"
        onClick={() =>
          execute((state) =>
            duplicateSelectedBlock(state, () => crypto.randomUUID()),
          )
        }
      >
        Duplicate block
      </EditorMenuItem>
      <EditorMenuItem
        hint="Move the block up (⌘/Ctrl+Shift+↑)"
        onClick={() => run(-1)}
      >
        Move block up
      </EditorMenuItem>
      <EditorMenuItem
        hint="Move the block down (⌘/Ctrl+Shift+↓)"
        onClick={() => run(1)}
      >
        Move block down
      </EditorMenuItem>
      <EditorMenuItem
        hint="Copy a link directly to this block"
        onClick={async () => {
          const target = targetState();
          const id = target && selectedBlock(target)?.id;
          if (!id) return;
          const url = new URL(window.location.href);
          url.hash = new URLSearchParams({ block: id }).toString();
          try {
            await navigator.clipboard.writeText(url.toString());
          } catch {
            toast.error("Could not copy the block link. Please try again.");
          }
        }}
      >
        Copy block link
      </EditorMenuItem>
      <EditorMenuItem
        hint="Delete the block and everything nested inside it"
        variant="destructive"
        onClick={() => run()}
      >
        {selectedBlock(state)?.node.firstChild?.type.name === "table"
          ? "Delete table"
          : "Delete block"}
      </EditorMenuItem>
      <DropdownMenuSeparator />
      <EditorMenuItem
        hint="Undo the last edit (⌘/Ctrl+Z)"
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
        hint="Redo the last undone edit (⌘/Ctrl+Shift+Z)"
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
        finalFocus={() => {
          return restoreEditorFocus(editor);
        }}
      >
        <BlockActions editor={editor} blockId={context.id} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TiptapSlashMenu({ editor }: { editor?: Editor }) {
  const state = useTiptapState(editor);
  const query = state ? slashKey.getState(state) : null;
  const [position, setPosition] = useState({ left: 0, maxHeight: 280, top: 0 });
  const popup = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    if (query) {
      dom.setAttribute("aria-controls", menuId);
      dom.setAttribute("aria-activedescendant", `${menuId}-${query.index}`);
      dom.setAttribute("aria-autocomplete", "list");
    }
    return () => {
      dom.removeAttribute("aria-controls");
      dom.removeAttribute("aria-activedescendant");
      dom.removeAttribute("aria-autocomplete");
    };
  }, [editor, query, menuId]);
  useEffect(() => {
    if (!editor || !query) return;
    const update = () => {
      const rect = editor.view.coordsAtPos(query.from);
      const viewport = window.visualViewport;
      const bottom =
        (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      const top = rect.bottom + 4;
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)),
        maxHeight: Math.min(280, Math.max(80, bottom - top - 8)),
        top: Math.min(top, bottom - 100),
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [editor, query]);
  useEffect(() => {
    if (!query) return;
    popup.current
      ?.querySelector<HTMLElement>(`[data-choice-index="${query.index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [query]);
  if (!editor || !query || editor.view.composing) return null;
  const choices = filteredBlockChoices(query.query);
  return createPortal(
    <div
      ref={popup}
      id={menuId}
      data-tiptap-controls=""
      role="listbox"
      aria-label="Block commands"
      className="fixed z-50 w-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={position}
    >
      {choices.length ? (
        choices.map((choice, index) => (
          <EditorHint
            key={choice.title}
            label={`Insert ${choice.title.toLowerCase()}`}
          >
            <button
              type="button"
              key={choice.title}
              id={`${menuId}-${index}`}
              role="option"
              data-choice-index={index}
              aria-selected={index === query.index}
              tabIndex={-1}
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent aria-selected:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const tr = applySlashChoice(editor.state, choice, () =>
                  crypto.randomUUID(),
                );
                if (tr) editor.view.dispatch(tr);
                editor.view.focus();
              }}
            >
              {choice.title}
            </button>
          </EditorHint>
        ))
      ) : (
        <p className="p-2 text-sm">No matching blocks</p>
      )}
    </div>,
    document.body,
  );
}
