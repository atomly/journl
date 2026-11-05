"use client";

import {
  indentBlock,
  selectedBlock,
  selectedBlocks,
} from "@acme/better-editor/engine/commands";
import { captureLink } from "@acme/better-editor/engine/references";
import { safeEditorUrl } from "@acme/better-editor/engine/schema";
import { blockChoices } from "@acme/better-editor/engine/suggestions";
import {
  canChangeBlockType,
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
import { useEditorEditable } from "@acme/better-editor/ui/use-editor-editable";
import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@acme/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";
import { TooltipProvider } from "@acme/ui/tooltip";
import { useIsMobile } from "@acme/ui/use-mobile";
import { Button as SurfaceButton } from "@base-ui/react/button";
import type { Editor } from "@tiptap/core";
import {
  type EditorState,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import {
  AlignLeft,
  AtSign,
  Bold,
  Code,
  Copy,
  IndentDecrease,
  IndentIncrease,
  Italic,
  MoreHorizontal,
  Paintbrush,
  Strikethrough,
  Underline,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { copyTextToClipboard } from "~/lib/clipboard";
import { BlockActions } from "./block-actions";
import type { DocumentEditorServices } from "./document-editor-services";
import { DocumentTableMenu } from "./table-menu";

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

function BlockTypeSelector({ editor }: { editor: Editor }) {
  const editable = useEditorEditable(editor);
  const selection = useEditorSelector((instance) => {
    if (instance.isDestroyed) return undefined;
    const body = selectedBlock(instance.state)?.node.firstChild;
    return {
      enabled: Boolean(body?.isTextblock),
      options: blockChoices.filter((choice) =>
        canChangeBlockType(instance.state, choice.type, choice.props),
      ),
      value:
        body?.type.name === "heading"
          ? body.attrs.props?.isToggleable
            ? "Toggle heading"
            : `Heading ${body.attrs.props?.level ?? 1}`
          : (blockChoices.find((choice) => choice.type === body?.type.name)
              ?.title ?? ""),
    };
  }, editor);
  const mobile = useIsMobile();
  const value = selection?.value ?? "";
  const options = selection?.options ?? [];
  return (
    <Select
      value={value}
      items={Object.fromEntries(
        options.map((choice) => [
          choice.title,
          choice.title === "Text" ? "Paragraph" : choice.title,
        ]),
      )}
      onValueChange={(value) => {
        if (editor.isDestroyed || !editor.isEditable) return;
        const choice = blockChoices.find((choice) => choice.title === value);
        if (choice) {
          const tr = changeBlockType(editor.state, choice.type, choice.props);
          if (tr) editor.view.dispatch(tr);
          editor.view.focus();
        }
      }}
      disabled={!editable || !selection?.enabled}
    >
      <EditorToolbarControl
        label="Turn into a different block type"
        disabled={!editable || !selection?.enabled}
      >
        <SelectTrigger
          aria-label="Block type"
          className="border-none bg-transparent! shadow-none"
          onMouseDown={(event) => event.preventDefault()}
        >
          <SelectValue placeholder="Block" />
        </SelectTrigger>
      </EditorToolbarControl>
      <SelectContent
        data-tiptap-controls=""
        data-tiptap-owner={editor.instanceId}
        className="max-h-[min(20rem,var(--available-height))]"
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
        <SelectGroup>
          {options.map((choice) => (
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
        </SelectGroup>
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
        className="journl-editor-toolbar"
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
  const editable = useEditorEditable(editor);
  const capabilities = useEditorSelector((instance) => {
    if (instance.isDestroyed) return undefined;
    const body = selectedBlock(instance.state)?.node.firstChild;
    return {
      alignable: Boolean(
        body?.isTextblock &&
          body.type.name !== "quote" &&
          body.type.name !== "codeBlock",
      ),
      copyBlockId:
        selectedBlock(instance.state)?.id ??
        selectedBlocks(instance.state)[0]?.id,
      formattable:
        instance.state.selection instanceof CellSelection ||
        instance.can().setMark("bold"),
    };
  }, editor);
  const [colorsOpen, setColorsOpen] = useState(false);
  const dispatch = (create: (state: EditorState) => Transaction | null) => {
    if (editor.isDestroyed || !editor.isEditable) return;
    const tr = create(editor.state);
    if (tr) editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
  };
  const formattable = editable && (capabilities?.formattable ?? false);
  return (
    <>
      <EditorTool
        label="Copy block link"
        disabled={!services.getBlockUrl || !capabilities?.copyBlockId}
        onClick={() => {
          if (editor.isDestroyed) return;
          const id =
            selectedBlock(editor.state)?.id ??
            selectedBlocks(editor.state)[0]?.id;
          const url = id && services.getBlockUrl?.(id);
          if (url)
            void copyTextToClipboard(url).catch((error) =>
              services.onActionError?.(error),
            );
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
          <EditorHint label="Insert link or reference">
            <Button variant="ghost" size="icon" aria-label="Insert link">
              <AtSign />
            </Button>
          </EditorHint>
        }
      >
        {({ url, editor, restoreSelection, close }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!safeEditorUrl(url)}
            onClick={() => {
              if (
                editor.isDestroyed ||
                !editor.isEditable ||
                !restoreSelection()
              )
                return;
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
          disabled={!editable || !capabilities?.alignable}
        >
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="Text alignment"
                variant="ghost"
                size="icon"
                disabled={!editable || !capabilities?.alignable}
                onMouseDown={(event) => event.preventDefault()}
              >
                <AlignLeft />
              </Button>
            }
          />
        </EditorToolbarControl>
        <DropdownMenuContent
          data-tiptap-controls=""
          data-tiptap-owner={editor.instanceId}
          finalFocus={() => {
            return restoreEditorFocus(editor);
          }}
        >
          <DropdownMenuGroup>
            {["left", "center", "right", "justify"].map((value) => (
              <EditorMenuItem
                hint={`Align text ${value}`}
                disabled={!editable}
                key={value}
                onClick={() =>
                  dispatch((state) =>
                    setBlockProperties(state, {
                      textAlignment: value,
                    }),
                  )
                }
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </EditorMenuItem>
            ))}
          </DropdownMenuGroup>
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
                      disabled={!editable}
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
                        dispatch((state) => setTextColor(state, name, value));
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
        disabled={!editable}
        onClick={() => dispatch((state) => indentBlock(state))}
      >
        <IndentIncrease />
      </EditorTool>
      <EditorTool
        label="Outdent"
        disabled={!editable}
        onClick={() => dispatch((state) => indentBlock(state, true))}
      >
        <IndentDecrease />
      </EditorTool>
      <DropdownMenu modal={false}>
        <EditorToolbarControl label="More actions">
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="More actions"
                variant="ghost"
                size="icon"
                onMouseDown={(event) => event.preventDefault()}
              >
                <MoreHorizontal />
              </Button>
            }
          />
        </EditorToolbarControl>
        <DropdownMenuContent
          data-tiptap-controls=""
          data-tiptap-owner={editor.instanceId}
          finalFocus={() => {
            return restoreEditorFocus(editor);
          }}
        >
          <DropdownMenuGroup>
            <BlockMenuContent
              services={services}
              editor={editor}
              insertReference={insertReference}
              surface="toolbar"
            />
          </DropdownMenuGroup>
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
  surface = "block",
}: {
  editor: Editor;
  services?: DocumentEditorServices;
  blockId?: string;
  surface?: "block" | "toolbar";
  insertReference?: InsertReference;
}) {
  return (
    <>
      <DocumentTableMenu editor={editor} />
      {surface === "block" && (
        <ReferenceDisplayItems
          editor={editor}
          insertReference={insertReference}
        />
      )}
      <BlockActions
        services={services}
        editor={editor}
        blockId={blockId}
        includeFormatting={surface === "block"}
        includeCopyLink={surface === "block"}
        includeDelete={
          selectedBlock(editor.state)?.node.firstChild?.type.name !== "table"
        }
      />
    </>
  );
}
