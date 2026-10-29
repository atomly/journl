"use client";

import {
  indentBlock,
  selectedBlock,
} from "@acme/better-editor/engine/commands";
import { captureLink } from "@acme/better-editor/engine/references";
import { safeEditorUrl } from "@acme/better-editor/engine/schema";
import { blockChoices } from "@acme/better-editor/engine/suggestions";
import {
  changeBlockType,
  setBlockProperties,
  setTextColor,
} from "@acme/better-editor/engine/writing";
import {
  EditorHint,
  EditorMenuItem,
  EditorToolbarControl,
  restoreEditorFocus,
} from "@acme/better-editor/ui/controls";
import { useEditorSelector } from "@acme/better-editor/ui/editor-root";
import { EditorToolbar } from "@acme/better-editor/ui/editor-toolbar";
import { LinkMenu } from "@acme/better-editor/ui/link-menu";
import { MarkButton } from "@acme/better-editor/ui/mark-button";
import {
  type InsertReference,
  ReferenceDisplayControl,
  ReferenceDisplayItems,
} from "@acme/better-editor/ui/reference-display";
import { TableMenuItems } from "@acme/better-editor/ui/table-controls";
import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@acme/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";
import { TooltipProvider } from "@acme/ui/tooltip";
import { useIsMobile } from "@acme/ui/use-mobile";
import { Button as SurfaceButton } from "@base-ui/react/button";
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
import { type ReactNode, useState } from "react";
import { BlockActions } from "./block-actions";
import type { DocumentEditorServices } from "./document-editor-services";

function EditorTool({
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
  return blockChoices.filter((choice) =>
    Boolean(changeBlockType(editor.state, choice.type, choice.props)),
  );
}

function BlockTypeMenu({ editor }: { editor: Editor }) {
  const choices = blockTypeOptions(editor);
  return (
    <DropdownMenuSub>
      <EditorHint label="Block type">
        <DropdownMenuSubTrigger disabled={!choices.length}>
          Turn into
        </DropdownMenuSubTrigger>
      </EditorHint>
      <DropdownMenuSubContent
        data-tiptap-controls=""
        data-tiptap-owner={editor.instanceId}
      >
        {choices.map((choice) => (
          <EditorMenuItem
            key={choice.title}
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

function BlockTypeSelector({ editor }: { editor: Editor }) {
  const state = useEditorSelector(
    (instance) => instance.state,
    editor,
    Object.is,
  );
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
        data-tiptap-owner={editor.instanceId}
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

export function DocumentToolbar({
  editor,
  services = {},
  insertReference,
  mode = "floating",
  visibility = "selection",
}: {
  editor: Editor;
  services?: DocumentEditorServices;
  insertReference: InsertReference;
  mode?: "floating" | "sticky" | "inline";
  visibility?: "always" | "selection";
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  return (
    <TooltipProvider>
      <EditorToolbar
        editor={editor}
        mode={mode}
        visibility={visibility}
        open={linkOpen ? true : undefined}
        onEditorKeyDown={(event) => {
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "k" &&
            !event.isComposing
          ) {
            event.preventDefault();
            event.stopPropagation();
            setLinkOpen(true);
          }
        }}
      >
        <EditorToolbarItems
          services={services}
          editor={editor}
          insertReference={insertReference}
          linkOpen={linkOpen}
          onLinkOpenChange={setLinkOpen}
        />
      </EditorToolbar>
    </TooltipProvider>
  );
}
export function EditorToolbarItems({
  editor,
  services = {},
  insertReference,
  linkOpen,
  onLinkOpenChange,
}: {
  editor: Editor;
  services?: DocumentEditorServices;
  insertReference: InsertReference;
  linkOpen: boolean;
  onLinkOpenChange: (open: boolean) => void;
}) {
  const state = useEditorSelector(
    (instance) => instance.state,
    editor,
    Object.is,
  );
  const [colorsOpen, setColorsOpen] = useState(false);
  const dispatch = (tr: import("@tiptap/pm/state").Transaction | null) => {
    if (tr) editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
  };
  const body = state && selectedBlock(state)?.node.firstChild;
  const formattable = Boolean(
    state?.selection instanceof CellSelection || editor.can().setMark("bold"),
  );
  return (
    <>
      <EditorTool
        label="Copy block link"
        disabled={!services.getBlockUrl}
        onClick={() => {
          const id = selectedBlock(editor.state)?.id;
          const url = id && services.getBlockUrl?.(id);
          if (url)
            void navigator.clipboard
              .writeText(url)
              .catch((error) => services.onActionError?.(error));
        }}
      >
        <Copy />
      </EditorTool>
      <LinkMenu
        editor={editor}
        open={linkOpen}
        onOpenChange={onLinkOpenChange}
        inputLabel="Reference URL"
        renderTrigger={
          <Button variant="ghost" size="icon" aria-label="Insert link">
            <Link2 />
          </Button>
        }
      >
        {({ url, editor, restoreSelection, close }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!safeEditorUrl(url)}
            onClick={() => {
              if (!restoreSelection()) return;
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
              close();
              editor.view.focus();
            }}
          >
            Insert mention
          </Button>
        )}
      </LinkMenu>
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
        <EditorHint
          key={mark}
          label={mark.charAt(0).toUpperCase() + mark.slice(1)}
        >
          <MarkButton
            editor={editor}
            mark={mark}
            aria-label={mark.charAt(0).toUpperCase() + mark.slice(1)}
            render={<Button variant="ghost" size="icon" />}
          >
            <Icon />
          </MarkButton>
        </EditorHint>
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
          data-tiptap-owner={editor.instanceId}
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
                  setBlockProperties(editor.state, {
                    textAlignment: value,
                  }),
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
          data-tiptap-owner={editor.instanceId}
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
                    <SurfaceButton
                      key={value}
                      type="button"
                      aria-label={`${name === "textColor" ? "Text" : "Highlight"} ${value}`}
                      className="flex size-7 items-center justify-center rounded border hover:bg-muted"
                      style={{
                        backgroundColor:
                          name === "backgroundColor"
                            ? `var(--better-editor-background-${value},transparent)`
                            : undefined,
                        color: `var(--better-editor-text-${value},var(--foreground))`,
                      }}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        dispatch(setTextColor(editor.state, name, value));
                        setColorsOpen(false);
                      }}
                    >
                      A
                    </SurfaceButton>
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
        <EditorToolbarControl label="More actions">
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
          data-tiptap-owner={editor.instanceId}
          finalFocus={() => {
            return restoreEditorFocus(editor);
          }}
        >
          <BlockMenuContent
            services={services}
            editor={editor}
            insertReference={insertReference}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/** Identical block/reference/history actions from the handle and toolbar menus. */
export function BlockMenuContent({
  editor,
  services = {},
  blockId,
  insertReference,
}: {
  editor: Editor;
  services?: DocumentEditorServices;
  blockId?: string;
  insertReference?: InsertReference;
}) {
  return (
    <>
      <BlockTypeMenu editor={editor} />
      <TableMenuItems editor={editor} />
      <ReferenceDisplayItems
        editor={editor}
        insertReference={insertReference}
      />
      <BlockActions services={services} editor={editor} blockId={blockId} />
    </>
  );
}
