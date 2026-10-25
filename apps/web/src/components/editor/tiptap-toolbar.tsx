"use client";

import {
  blockChoices,
  captureLink,
  changeBlockType,
  indentBlock,
  safeEditorUrl,
  selectedBlock,
  setBlockProperties,
  setTextColor,
  setTextMark,
  textMarkActive,
  toggleTextMark,
} from "@acme/tiptap";
import { Toolbar } from "@base-ui/react/toolbar";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import {
  AlignLeft,
  Bold,
  Code,
  Copy,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  MoreHorizontal,
  Paintbrush,
  Strikethrough,
  Underline,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useIsMobile } from "~/hooks/use-mobile";
import {
  EditorHint,
  EditorMenuItem,
  EditorToolbarControl,
  restoreEditorFocus,
} from "./tiptap-controls";
import {
  type InsertReference,
  ReferenceDisplayControl,
  ReferenceDisplayItems,
} from "./tiptap-reference-display";
import { TableMenuItems } from "./tiptap-table-controls";
import { BlockActions, useTiptapState } from "./tiptap-writing-controls";

export function EditorTool({
  label,
  children,
  active,
  onClick,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <EditorToolbarControl label={label} disabled={disabled}>
      <Button
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        variant="ghost"
        size="icon"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
      >
        {children}
      </Button>
    </EditorToolbarControl>
  );
}

function blockTypeOptions(editor: Editor) {
  const body = selectedBlock(editor.state)?.node.firstChild;
  let references = false;
  body?.descendants((node) => {
    if (node.type.name === "contentReference") references = true;
  });
  return blockChoices
    .filter((choice) => choice.type !== "divider")
    .map((choice) => ({
      ...choice,
      disabled:
        !body?.isTextblock ||
        (choice.type === "codeBlock" && references) ||
        (choice.type === "table" && Boolean(body.content.size)),
    }));
}

function BlockTypeMenu({ editor }: { editor: Editor }) {
  const choices = blockTypeOptions(editor);
  return (
    <DropdownMenuSub>
      <EditorHint label="Turn this block into a different block type">
        <DropdownMenuSubTrigger
          disabled={choices.every((choice) => choice.disabled)}
        >
          Turn into
        </DropdownMenuSubTrigger>
      </EditorHint>
      <DropdownMenuSubContent data-tiptap-controls="">
        {choices.map((choice) => (
          <EditorMenuItem
            key={choice.title}
            disabled={choice.disabled}
            hint={`Turn into ${choice.title.toLowerCase()}`}
            onClick={() => {
              const tr = changeBlockType(
                editor.state,
                choice.type,
                choice.props,
              );
              if (tr) editor.view.dispatch(tr);
              editor.view.focus();
            }}
          >
            {choice.title === "Text" ? "Paragraph" : choice.title}
          </EditorMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function BlockTypeSelector({ editor }: { editor: Editor }) {
  const state = useTiptapState(editor);
  const mobile = useIsMobile();
  const body = state && selectedBlock(state)?.node.firstChild;
  const value =
    body?.type.name === "heading"
      ? body.attrs.props?.isToggleable
        ? "Toggle heading"
        : `Heading ${body.attrs.props?.level ?? 1}`
      : (blockChoices.find((choice) => choice.type === body?.type.name)
          ?.title ?? "");
  return (
    <Select
      value={value}
      onValueChange={(value) => {
        const choice = blockChoices.find((choice) => choice.title === value);
        if (choice) {
          const tr = changeBlockType(editor.state, choice.type, choice.props);
          if (tr) editor.view.dispatch(tr);
          editor.view.focus();
        }
      }}
      disabled={!body?.isTextblock}
    >
      <EditorToolbarControl
        label="Turn into a different block type"
        disabled={!body?.isTextblock}
      >
        <SelectTrigger
          aria-label="Block type"
          className="border-none bg-transparent! shadow-none"
          onMouseDown={(event) => event.preventDefault()}
        >
          <SelectValue>
            {value === "Text" ? "Paragraph" : value || "Block"}
          </SelectValue>
        </SelectTrigger>
      </EditorToolbarControl>
      <SelectContent
        data-tiptap-controls=""
        alignItemWithTrigger={false}
        onFocusCapture={(event) => {
          const from = event.relatedTarget;
          if (mobile && from instanceof HTMLElement && from.isContentEditable)
            from.focus({ preventScroll: true });
        }}
        finalFocus={() => {
          return restoreEditorFocus(editor);
        }}
      >
        {blockTypeOptions(editor).map((choice) => (
          <EditorHint
            key={choice.title}
            label={`Turn this block into ${choice.title === "Text" ? "a paragraph" : choice.title.toLowerCase()}`}
          >
            <SelectItem
              key={choice.title}
              value={choice.title}
              disabled={choice.disabled}
              onMouseDown={(event) => event.preventDefault()}
            >
              {choice.title === "Text" ? "Paragraph" : choice.title}
            </SelectItem>
          </EditorHint>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TiptapToolbar({
  editor,
  insertReference,
}: {
  editor: Editor;
  insertReference: InsertReference;
}) {
  const state = useTiptapState(editor);
  const mobile = useIsMobile();
  const [focused, setFocused] = useState(editor.isFocused);
  const [linkOpen, setLinkOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [position, setPosition] = useState({ left: 0, maxWidth: 720, top: 0 });
  const toolbar = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState(false);
  const [focusControls, setFocusControls] = useState(false);
  const tabNavigation = useRef(false);
  const [navigationMessage, setNavigationMessage] = useState("");
  const hintId = useId();
  useEffect(() => {
    const root = editor.view.dom;
    const focus = () => setFocused(true);
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !root.contains(event.target) &&
        !event.target.closest("[data-tiptap-controls]")
      ) {
        setFocused(false);
        setRequested(false);
      }
    };
    root.setAttribute("aria-describedby", hintId);
    root.setAttribute("aria-keyshortcuts", "Alt+F10 Control+m");
    const key = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (
        event.ctrlKey &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.toLowerCase() === "m"
      ) {
        event.preventDefault();
        event.stopPropagation();
        tabNavigation.current = !tabNavigation.current;
        setNavigationMessage(
          tabNavigation.current
            ? "Tab now moves between controls. Press Control+M to use Tab for indentation again."
            : "Tab now indents text or moves between table cells. Press Control+M to use Tab to leave the editor.",
        );
        return;
      }
      if (event.key === "Tab" && tabNavigation.current) {
        // Allow the browser's native focus navigation without running editor keymaps.
        event.stopPropagation();
        return;
      }
      if (event.altKey && event.key === "F10") {
        event.preventDefault();
        event.stopPropagation();
        setRequested(true);
        setFocusControls(true);
        return;
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !event.isComposing
      ) {
        event.preventDefault();
        event.stopPropagation();
        setRequested(true);
        setLinkOpen(true);
        setUrl(captureLink(editor.state)?.href ?? "");
      }
    };
    editor.on("focus", focus);
    document.addEventListener("pointerdown", outside);
    root.addEventListener("keydown", key, true);
    return () => {
      editor.off("focus", focus);
      document.removeEventListener("pointerdown", outside);
      root.removeEventListener("keydown", key, true);
      root.removeAttribute("aria-describedby");
      root.removeAttribute("aria-keyshortcuts");
    };
  }, [editor, hintId]);
  const visible =
    mobile ||
    requested ||
    Boolean(focused && state && (!state.selection.empty || captureLink(state)));
  useEffect(() => {
    if (!focusControls || !visible) return;
    const frame = requestAnimationFrame(() => {
      toolbar.current
        ?.querySelector<HTMLElement>("button:not(:disabled)")
        ?.focus();
      setFocusControls(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusControls, visible]);
  useEffect(() => {
    if (!visible || mobile) return;
    const update = () => {
      if (editor.isDestroyed) return;
      const selection = (state ?? editor.state).selection;
      const start = editor.view.coordsAtPos(selection.from);
      const end = editor.view.coordsAtPos(selection.to);
      let selectionTop = start.top;
      let selectionLeft = start.left;
      let selectionRight = end.right;
      if (selection instanceof CellSelection) {
        const cells: DOMRect[] = [];
        selection.forEachCell((_cell, pos) => {
          const element = editor.view.nodeDOM(pos);
          if (element instanceof HTMLElement)
            cells.push(element.getBoundingClientRect());
        });
        if (cells.length) {
          const anchor = editor.view.nodeDOM(selection.$anchorCell.pos);
          selectionTop =
            anchor instanceof HTMLElement
              ? (anchor.closest("table")?.getBoundingClientRect().top ??
                start.top)
              : start.top;
          selectionLeft = Math.min(...cells.map((rect) => rect.left));
          selectionRight = Math.max(...cells.map((rect) => rect.right));
        }
      }
      const bounds = editor.view.dom.getBoundingClientRect();
      const left = Math.max(8, bounds.left + 8);
      const right = Math.min(window.innerWidth - 8, bounds.right - 8);
      const maxWidth = Math.max(120, right - left);
      const width = Math.min(toolbar.current?.offsetWidth ?? 550, maxWidth);
      setPosition({
        left: Math.max(
          left,
          Math.min((selectionLeft + selectionRight - width) / 2, right - width),
        ),
        maxWidth,
        top: Math.max(
          64,
          selectionTop -
            (toolbar.current?.offsetHeight ?? 40) -
            (selection instanceof CellSelection ? 36 : 8),
        ),
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [editor, state, visible, mobile]);
  const keyboardHint = (
    <p id={hintId} className="sr-only">
      Press Alt+F10 for formatting controls. Use arrow keys in the toolbar and
      Escape to return to writing. Press Control+M to switch Tab between editing
      and moving between controls.
    </p>
  );
  const keyboardStatus = (
    <p role="status" aria-live="polite" className="sr-only">
      {navigationMessage}
    </p>
  );
  if (!visible)
    return (
      <>
        {keyboardHint}
        {keyboardStatus}
      </>
    );
  const dispatch = (tr: import("@tiptap/pm/state").Transaction | null) => {
    if (tr) editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
  };
  const body = state && selectedBlock(state)?.node.firstChild;
  const formattable = Boolean(
    state?.selection instanceof CellSelection ||
      (state?.selection.$from.parent.isTextblock &&
        state.selection.$from.parent.type.name !== "codeBlock"),
  );
  const content = (
    <TooltipProvider>
      <Toolbar.Root
        ref={toolbar}
        onKeyDownCapture={(event) => {
          if (
            event.key !== "Escape" ||
            !toolbar.current?.contains(event.target as Node) ||
            toolbar.current.querySelector('[aria-expanded="true"]')
          )
            return;
          event.preventDefault();
          setRequested(false);
          editor.view.focus();
        }}
        data-tiptap-controls=""
        data-tiptap-toolbar={mobile ? "mobile" : "selection"}
        role="toolbar"
        aria-label="Editor controls"
        className="journl-formatting-toolbar"
        style={mobile ? undefined : { position: "fixed", ...position }}
      >
        <EditorTool
          label="Copy block link"
          onClick={() => {
            const id = selectedBlock(editor.state)?.id;
            if (id)
              void navigator.clipboard
                .writeText(`${location.origin}${location.pathname}#block=${id}`)
                .catch(() =>
                  toast.error(
                    "Could not copy the block link. Please try again.",
                  ),
                );
          }}
        >
          <Copy />
        </EditorTool>
        <Popover
          open={linkOpen}
          onOpenChange={(open) => {
            if (open) setUrl(captureLink(editor.state)?.href ?? "");
            setLinkOpen(open);
          }}
        >
          <EditorToolbarControl label="Edit link (⌘/Ctrl+K)">
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Insert link"
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <Link2 />
                </Button>
              }
            />
          </EditorToolbarControl>
          <PopoverContent
            data-tiptap-controls=""
            finalFocus={() => {
              setRequested(false);
              return restoreEditorFocus(editor);
            }}
          >
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const href = safeEditorUrl(url);
                if (!href) return;
                const existing = captureLink(editor.state);
                const mark = editor.schema.marks.link;
                if (!mark) return;
                const tr =
                  !existing && editor.state.selection.empty
                    ? editor.state.tr.replaceSelectionWith(
                        editor.schema.text(url, [mark.create({ href })]),
                      )
                    : setTextMark(
                        editor.state,
                        "link",
                        { href },
                        existing || undefined,
                      );
                if (tr) editor.view.dispatch(tr);
                setUrl("");
                setLinkOpen(false);
                setRequested(false);
              }}
            >
              <label
                className="font-medium text-sm"
                htmlFor={`reference-${editor.instanceId}`}
              >
                Link to a note or URL
              </label>
              <input
                id={`reference-${editor.instanceId}`}
                aria-label="Reference URL"
                type="url"
                required
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="h-9 rounded-lg border bg-background px-3 text-sm"
              />
              <EditorHint label="Apply a plain text link">
                <Button type="submit" size="sm">
                  Apply link
                </Button>
              </EditorHint>
              <EditorHint label="Insert a compact mention with a source preview">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!safeEditorUrl(url)}
                  onClick={() => {
                    const existing = captureLink(editor.state);
                    if (existing)
                      editor.view.dispatch(
                        editor.state.tr.setSelection(
                          TextSelection.create(
                            editor.state.doc,
                            existing.from,
                            existing.to,
                          ),
                        ),
                      );
                    insertReference(url, existing?.label, "contentReference");
                    setUrl("");
                    setLinkOpen(false);
                    setRequested(false);
                  }}
                >
                  Insert mention
                </Button>
              </EditorHint>
            </form>
          </PopoverContent>
        </Popover>
        <BlockTypeSelector editor={editor} />
        <ReferenceDisplayControl
          editor={editor}
          insertReference={insertReference}
        />
        {(
          [
            ["bold", Bold],
            ["italic", Italic],
            ["underline", Underline],
            ["strike", Strikethrough],
            ["code", Code],
          ] as const
        ).map(([mark, Icon]) => (
          <EditorTool
            key={mark}
            label={mark.charAt(0).toUpperCase() + mark.slice(1)}
            active={Boolean(state && textMarkActive(state, mark))}
            disabled={!formattable}
            onClick={() => dispatch(toggleTextMark(editor.state, mark))}
          >
            <Icon />
          </EditorTool>
        ))}
        <DropdownMenu modal={false}>
          <EditorToolbarControl
            label="Text alignment"
            disabled={
              !body?.isTextblock ||
              body?.type.name === "quote" ||
              body?.type.name === "codeBlock"
            }
          >
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Text alignment"
                variant="ghost"
                size="icon"
                disabled={
                  !body?.isTextblock ||
                  body?.type.name === "quote" ||
                  body?.type.name === "codeBlock"
                }
                onMouseDown={(event) => event.preventDefault()}
              >
                <AlignLeft />
              </Button>
            </DropdownMenuTrigger>
          </EditorToolbarControl>
          <DropdownMenuContent
            data-tiptap-controls=""
            finalFocus={() => {
              return restoreEditorFocus(editor);
            }}
          >
            {["left", "center", "right", "justify"].map((value) => (
              <EditorMenuItem
                hint={`Align text ${value}`}
                key={value}
                onClick={() =>
                  dispatch(
                    setBlockProperties(editor.state, { textAlignment: value }),
                  )
                }
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </EditorMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover open={colorsOpen} onOpenChange={setColorsOpen}>
          <EditorToolbarControl
            label="Text color and highlight"
            disabled={!formattable}
          >
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Colors"
                  disabled={!formattable}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <Paintbrush />
                </Button>
              }
            />
          </EditorToolbarControl>
          <PopoverContent
            data-tiptap-controls=""
            finalFocus={() => {
              return restoreEditorFocus(editor);
            }}
          >
            {(["textColor", "backgroundColor"] as const).map((name) => (
              <div key={name}>
                <p className="mb-2 font-medium text-muted-foreground text-xs">
                  {name === "textColor" ? "Text color" : "Highlight"}
                </p>
                <div className="flex flex-wrap gap-1">
                  {[
                    "default",
                    "gray",
                    "brown",
                    "red",
                    "orange",
                    "yellow",
                    "green",
                    "blue",
                    "purple",
                    "pink",
                  ].map((value) => (
                    <EditorHint
                      key={value}
                      label={`${name === "textColor" ? "Text color" : "Highlight"}: ${value}`}
                    >
                      <button
                        key={value}
                        type="button"
                        aria-label={`${name === "textColor" ? "Text" : "Highlight"} ${value}`}
                        className="flex size-7 items-center justify-center rounded border hover:bg-muted"
                        style={{
                          backgroundColor:
                            name === "backgroundColor"
                              ? `var(--journl-background-${value},transparent)`
                              : undefined,
                          color: `var(--journl-text-${value},var(--foreground))`,
                        }}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          dispatch(setTextColor(editor.state, name, value));
                          setColorsOpen(false);
                        }}
                      >
                        A
                      </button>
                    </EditorHint>
                  ))}
                </div>
              </div>
            ))}
          </PopoverContent>
        </Popover>
        <EditorTool
          label="Indent"
          onClick={() => dispatch(indentBlock(editor.state))}
        >
          <IndentIncrease />
        </EditorTool>
        <EditorTool
          label="Outdent"
          onClick={() => dispatch(indentBlock(editor.state, true))}
        >
          <IndentDecrease />
        </EditorTool>
        <DropdownMenu modal={false}>
          <EditorToolbarControl label="Block actions and undo/redo (Alt+F10 focuses editor controls)">
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="More formatting"
                variant="ghost"
                size="icon"
                onMouseDown={(event) => event.preventDefault()}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
          </EditorToolbarControl>
          <DropdownMenuContent
            data-tiptap-controls=""
            finalFocus={() => {
              return restoreEditorFocus(editor);
            }}
          >
            <BlockMenuContent
              editor={editor}
              insertReference={insertReference}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </Toolbar.Root>
      {keyboardHint}
      {keyboardStatus}
    </TooltipProvider>
  );
  return mobile ? (
    <div className="journl-mobile-toolbar">{content}</div>
  ) : (
    createPortal(content, document.body)
  );
}

/** Identical block/reference/history actions from the handle and toolbar menus. */
export function BlockMenuContent({
  editor,
  blockId,
  insertReference,
}: {
  editor: Editor;
  blockId?: string;
  insertReference?: InsertReference;
}) {
  const state = useTiptapState(editor);
  const body = state && selectedBlock(state)?.node.firstChild;
  return (
    <>
      <BlockTypeMenu editor={editor} />
      <TableMenuItems editor={editor} />
      <ReferenceDisplayItems
        editor={editor}
        insertReference={insertReference}
      />
      {body?.type.name === "codeBlock" && (
        <EditorHint label="Syntax language for this code block">
          <label className="flex flex-col gap-1 p-2 text-sm">
            Language
            <input
              aria-label="Code language"
              className="rounded border bg-background p-1"
              value={body.attrs.props?.language ?? "text"}
              onChange={(event) => {
                const tr = setBlockProperties(editor.state, {
                  language: event.target.value,
                });
                if (tr) editor.view.dispatch(tr);
              }}
            />
          </label>
        </EditorHint>
      )}
      <BlockActions editor={editor} blockId={blockId} />
    </>
  );
}
