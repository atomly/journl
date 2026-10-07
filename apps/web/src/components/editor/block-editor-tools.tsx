"use client";

import {
  type BlockPrimitive,
  type EditorPrimitive,
  ReferenceRenderContext,
  schema,
} from "@acme/blocknote/schema";
import {
  FormattingToolbarExtension,
  filterSuggestionItems,
} from "@blocknote/core/extensions";
import {
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  SuggestionMenuController,
  useBlockNoteEditor,
  useComponentsContext,
  useEditorState,
  useExtension,
  usePortalElement,
  useSelectedBlocks,
} from "@blocknote/react";
import {
  AIExtension,
  getAISlashMenuItems,
  useAIDictionary,
} from "@blocknote/xl-ai";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Link2,
  MessageSquarePlus,
  MoreHorizontal,
  PanelsTopLeft,
  Unlink,
} from "lucide-react";
import { useContext, useRef, useState } from "react";
import { RiSparkling2Fill } from "react-icons/ri";
import removeMarkdown from "remove-markdown";
import { toast } from "sonner";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { useIsMobile } from "~/hooks/use-mobile";
import { useTRPC } from "~/trpc/react";
import { BlockActions, inlineReferenceAction } from "./block-editor-block-menu";
import {
  type CapturedReferenceLink,
  captureReferenceLink,
  convertCapturedReferenceLink,
} from "./reference-link-conversion";

export function BlockEditorFloatingToolbar() {
  const isMobile = useIsMobile();

  if (isMobile) return null;

  return (
    <FormattingToolbarController
      floatingUIOptions={{
        useFloatingOptions: {
          strategy: "fixed",
        },
      }}
      formattingToolbar={() => (
        <FormattingToolbar>
          <BlockEditorAIButton />
          <BlockEditorSelectionButton />
          <BlockEditorCopyBlockLinkButton />
          <BlockEditorFormattingItems />
        </FormattingToolbar>
      )}
    />
  );
}

export function BlockEditorStickyToolbar() {
  const isMobile = useIsMobile();

  return (
    <div
      className="sticky z-4000 rounded-lg px-6 shadow-sm transition-[top] duration-300 ease-out motion-reduce:transition-none md:hidden md:px-2"
      style={{
        top: "calc(var(--app-visual-viewport-offset-top, 0px) + var(--app-header-offset, 0px))",
      }}
    >
      <FormattingToolbar>
        {isMobile && (
          <>
            <BlockEditorAIButton />
            <BlockEditorSelectionButton />
            <BlockEditorCopyBlockLinkButton />
          </>
        )}
        <BlockEditorFormattingItems />
      </FormattingToolbar>
    </div>
  );
}

/** Reference blocks carry URLs but are not files. Keep their actions consistent
 * with the context menu instead of inferring file controls from a URL prop. */
export function BlockEditorFormattingItems() {
  const editor = useBlockNoteEditor(schema);
  const blocks = useSelectedBlocks(editor);
  const badgeOnly = useEditorState({
    editor,
    selector: ({ editor }) => {
      const { doc, selection } = editor.prosemirrorState;
      return (
        selection.to - selection.from === 1 &&
        doc.nodeAt(selection.from)?.type.name === "contentReference"
      );
    },
  });
  const hasReferenceBlock = blocks.some(
    (block) => block.type === "referenceCard" || block.type === "contentEmbed",
  );
  return (
    <>
      <BlockEditorReferenceActionsButton />
      <BlockEditorConvertLinkButton />
      {getFormattingToolbarItems().filter(
        (item) =>
          (!hasReferenceBlock || !/file/i.test(String(item.key))) &&
          (!badgeOnly ||
            /^(nestBlockButton|unnestBlockButton)$/.test(String(item.key))),
      )}
    </>
  );
}

export function selectedReferenceAction(editor: EditorPrimitive) {
  const { doc, selection } = editor.prosemirrorState;
  if (selection.empty) return null;
  let referencePos: number | undefined;
  let count = 0;
  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (
      node.type.name === "contentReference" &&
      pos >= selection.from &&
      pos + node.nodeSize <= selection.to
    ) {
      referencePos = pos;
      count += 1;
    }
  });
  if (count !== 1 || referencePos === undefined) return null;
  const dom = editor.prosemirrorView.nodeDOM(referencePos);
  if (!(dom instanceof Element)) return null;
  const id = dom.closest<HTMLElement>("[data-id]")?.dataset.id;
  const block = id ? editor.getBlock(id) : undefined;
  const reference = dom.matches("[data-inline-content-type='contentReference']")
    ? dom
    : dom.querySelector("[data-inline-content-type='contentReference']");
  if (!block || !reference) return null;
  const inlineReference = inlineReferenceAction(reference, block);
  return inlineReference ? { block, inlineReference } : null;
}

/** Shared source/display/block actions for a selected card or inline badge. */
export function BlockEditorReferenceActionsButton() {
  const editor = useBlockNoteEditor(schema);
  const Components = useComponentsContext();
  const portalElement = usePortalElement();
  const blocks = useSelectedBlocks(editor);
  // Changes within a paragraph do not necessarily change the selected blocks.
  useEditorState({
    editor,
    selector: ({ editor }) => ({
      from: editor.prosemirrorState.selection.from,
      to: editor.prosemirrorState.selection.to,
    }),
  });
  const [open, setOpen] = useState(false);
  const current =
    selectedReferenceAction(editor) ??
    (blocks.length === 1 &&
    (blocks[0]?.type === "referenceCard" || blocks[0]?.type === "contentEmbed")
      ? { block: blocks[0] }
      : null);
  const saved = useRef(current);
  if (!open) saved.current = current;
  const selected = open ? saved.current : current;
  if (!Components || !editor.isEditable || !selected) return null;
  return (
    <Components.Generic.Menu.Root
      portalElement={portalElement}
      position="bottom-start"
      onOpenChange={setOpen}
    >
      <Components.Generic.Menu.Trigger>
        <Components.FormattingToolbar.Button
          label="Reference actions"
          mainTooltip="Reference actions"
          className="shrink-0"
        >
          <MoreHorizontal aria-hidden="true" />
        </Components.FormattingToolbar.Button>
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown>
        <BlockActions {...selected} />
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}

function BlockEditorCopyBlockLinkButton() {
  const editor = useBlockNoteEditor(schema);
  const Components = useComponentsContext();
  const [copied, setCopied] = useState(false);
  const blocks = useSelectedBlocks<
    typeof schema.blockSchema,
    typeof schema.inlineContentSchema,
    typeof schema.styleSchema
  >() as BlockPrimitive[];

  if (!Components || blocks.length !== 1 || !editor.isEditable) return null;

  async function copyBlockLink() {
    const url = new URL(window.location.href);
    url.hash = `block=${blocks[0]?.id ?? ""}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Components.FormattingToolbar.Button
      label={copied ? "Block link copied" : "Copy block link"}
      mainTooltip={copied ? "Block link copied" : "Copy block link"}
      onClick={() => void copyBlockLink()}
      className="shrink-0"
    >
      {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
    </Components.FormattingToolbar.Button>
  );
}

export function BlockEditorConvertLinkButton() {
  const editor = useBlockNoteEditor(schema);
  useEditorState({
    editor,
    selector: ({ editor }) => ({
      from: editor.prosemirrorState.selection.from,
      to: editor.prosemirrorState.selection.to,
    }),
  });
  const Components = useComponentsContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [converted, setConverted] = useState(false);
  const [open, setOpen] = useState(false);
  const adapter = useContext(ReferenceRenderContext);
  const portalElement = usePortalElement();
  const saved = useRef<CapturedReferenceLink | null>(null);
  const current = captureReferenceLink(editor);
  if (!open && current) saved.current = current;
  const captured = open ? saved.current : current;
  if (!Components || !adapter || !captured) return null;
  const canPromote = adapter.canConvertInline?.(captured.blockId) ?? false;
  async function convertLink(
    display: "contentReference" | "referenceCard" | "contentEmbed",
  ) {
    if (!captured || !adapter) return;
    try {
      const result = await convertCapturedReferenceLink(
        editor,
        adapter,
        captured,
        display,
        (url) =>
          queryClient.fetchQuery(
            trpc.references.resolveUrls.queryOptions({ urls: [url] }),
          ),
      );
      if (result !== "converted") {
        toast.error(
          result === "changed"
            ? "The link changed. Select it again to change its display."
            : "This link is unavailable. The original link has been kept.",
        );
        return;
      }
      setConverted(true);
      window.setTimeout(() => setConverted(false), 1500);
    } catch {
      toast.error("Could not change the link display. Please try again.");
    }
  }

  return (
    <Components.Generic.Menu.Root
      portalElement={portalElement}
      position="bottom-start"
      preventFocusOnOpen
      onOpenChange={setOpen}
    >
      <Components.Generic.Menu.Trigger>
        <Components.FormattingToolbar.Button
          label="Reference display options"
          mainTooltip={
            converted ? "Link converted to reference" : "Display link as"
          }
          className="shrink-0"
        >
          {converted ? (
            <Check aria-hidden="true" />
          ) : (
            <PanelsTopLeft aria-hidden="true" />
          )}
        </Components.FormattingToolbar.Button>
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown>
        <Components.Generic.Menu.Label>
          Display as
        </Components.Generic.Menu.Label>
        <Components.Generic.Menu.Item
          onClick={() => void convertLink("contentReference")}
        >
          Inline
        </Components.Generic.Menu.Item>
        {canPromote && (
          <Components.Generic.Menu.Item
            onClick={() => void convertLink("referenceCard")}
          >
            Card
          </Components.Generic.Menu.Item>
        )}
        {canPromote && /\/(pages\/|journal\/)/.test(captured.href) && (
          <Components.Generic.Menu.Item
            onClick={() => void convertLink("contentEmbed")}
          >
            Embed
          </Components.Generic.Menu.Item>
        )}
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}

function BlockEditorAIButton() {
  const dict = useAIDictionary();
  const Components = useComponentsContext();
  const editor = useBlockNoteEditor(schema);
  const ai = useExtension(AIExtension);
  const formattingToolbar = useExtension(FormattingToolbarExtension);

  if (!Components || !editor.isEditable) {
    return null;
  }

  function handleClick() {
    const selection = editor.getSelection();
    const selectedBlockId = selection?.blocks.at(-1)?.id;
    const cursorBlockId = editor.getTextCursorPosition().block.id;
    const fallbackBlockId = editor.document.at(-1)?.id;
    const blockId = selectedBlockId || cursorBlockId || fallbackBlockId;

    if (!blockId) {
      return;
    }

    editor.focus();
    editor.setTextCursorPosition(blockId, "end");
    ai.openAIMenuAtBlock(blockId);
    formattingToolbar.store.setState(false);
  }

  return (
    <Components.Generic.Toolbar.Button
      className="bn-button"
      label={dict.formatting_toolbar.ai.tooltip}
      mainTooltip={dict.formatting_toolbar.ai.tooltip}
      icon={<RiSparkling2Fill />}
      onClick={handleClick}
    />
  );
}

/**
 * The slash menu with the AI option added.
 *
 * @param props - The props for the suggestion menu.
 * @returns The suggestion menu.
 */
export function BlockEditorSlashMenu() {
  const editor = useBlockNoteEditor(schema);
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      floatingUIOptions={{
        useFloatingOptions: {
          strategy: "fixed",
        },
      }}
      getItems={async (query) =>
        filterSuggestionItems(
          [
            ...getAISlashMenuItems(editor),
            ...getDefaultReactSlashMenuItems(editor),
            ...getReferenceSlashMenuItems(editor),
          ],
          query,
        )
      }
    />
  );
}

type ReferencePickerMode = "badge" | "card" | "block" | "embed" | "embedBlock";

function getReferenceSlashMenuItems(editor: EditorPrimitive) {
  return [
    {
      aliases: ["link note", "page reference"],
      group: "References",
      onItemClick: () => editor.insertInlineContent("[[::card "),
      title: "Reference note",
    },
    {
      aliases: ["link block", "block reference"],
      group: "References",
      onItemClick: () => editor.insertInlineContent("[[::block "),
      title: "Reference block",
    },
    {
      aliases: ["embed page", "embed journal"],
      group: "References",
      onItemClick: () => editor.insertInlineContent("[[::embed "),
      title: "Embed note",
    },
    {
      aliases: ["embed block"],
      group: "References",
      onItemClick: () => editor.insertInlineContent("[[::embedBlock "),
      title: "Embed block",
    },
  ];
}

function pickerModeAndQuery(value: string): {
  mode: ReferencePickerMode;
  query: string;
} {
  const match = value.match(/^\s*::(card|block|embedBlock|embed)\s+(.*)$/s);
  if (!match) return { mode: "badge", query: value.trim() };
  return {
    mode: match[1] as ReferencePickerMode,
    query: (match[2] ?? "").trim(),
  };
}

function insertPickedReference(
  editor: EditorPrimitive,
  mode: ReferencePickerMode,
  props: {
    blockId: string;
    documentId: string;
    label: string;
    resolutionToken: "";
    targetKind: "document" | "external";
    url: string;
    version: 1;
  },
) {
  if (mode === "badge" || mode === "block") {
    editor.insertInlineContent([{ props, type: "contentReference" }]);
    return;
  }
  const currentBlockId = editor.getTextCursorPosition().block.id;
  if (mode === "card") {
    editor.replaceBlocks([currentBlockId], [{ props, type: "referenceCard" }]);
    return;
  }
  if (props.targetKind === "document") {
    editor.replaceBlocks([currentBlockId], [{ props, type: "contentEmbed" }]);
  }
}

/** Search owned pages and journal entries from the `[[` editor trigger. */
export function BlockEditorReferenceMenu() {
  const editor = useBlockNoteEditor(schema);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return (
    <SuggestionMenuController
      triggerCharacter="[["
      floatingUIOptions={{
        useFloatingOptions: { strategy: "fixed" },
      }}
      getItems={async (query) => {
        const { mode, query: normalizedQuery } = pickerModeAndQuery(query);
        if (mode === "block" || mode === "embedBlock") {
          if (!normalizedQuery) return [];
          const { items } = await queryClient.fetchQuery(
            trpc.references.searchBlocks.queryOptions({
              limit: 10,
              query: normalizedQuery,
            }),
          );
          return items.map((match) => ({
            aliases: [],
            group: "Blocks",
            onItemClick: () =>
              insertPickedReference(editor, mode, {
                blockId: match.blockId,
                documentId: match.documentId,
                label: "",
                resolutionToken: "",
                targetKind: "document",
                url: match.href,
                version: 1,
              }),
            subtext: match.documentTitle,
            title: match.snippet || "Untitled block",
          }));
        }
        try {
          const parsed = new URL(normalizedQuery);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            const { items } = await queryClient.fetchQuery(
              trpc.references.resolveUrls.queryOptions({
                urls: [parsed.toString()],
              }),
            );
            const resolved = items[0];
            if (
              resolved?.target &&
              (mode !== "embed" || resolved.target.kind === "document")
            ) {
              const target = resolved.target;
              const label =
                resolved.preview.status === "ready"
                  ? resolved.preview.title
                  : target.kind === "external"
                    ? new URL(target.url).hostname
                    : "Referenced note";
              return [
                {
                  aliases: [],
                  group: "References",
                  onItemClick: () =>
                    insertPickedReference(editor, mode, {
                      blockId:
                        target.kind === "document"
                          ? (target.blockId ?? "")
                          : "",
                      documentId:
                        target.kind === "document" ? target.documentId : "",
                      label: "",
                      resolutionToken: "",
                      targetKind: target.kind,
                      url:
                        target.kind === "external"
                          ? target.url
                          : resolved.preview.status === "ready"
                            ? (resolved.preview.href ?? parsed.toString())
                            : parsed.toString(),
                      version: 1,
                    }),
                  subtext:
                    target.kind === "external"
                      ? "Convert URL to reference"
                      : mode === "embed"
                        ? "Embed note"
                        : "Reference page or journal entry",
                  title: label,
                },
              ];
            }
          }
        } catch {
          // Non-URL input uses the owned page and journal search below.
        }
        const { items } = await queryClient.fetchQuery(
          trpc.references.searchTargets.queryOptions({
            limit: 10,
            query: normalizedQuery,
          }),
        );
        return items.map((target) => ({
          aliases: [],
          group: "References",
          onItemClick: () =>
            insertPickedReference(editor, mode, {
              blockId: "",
              documentId: target.documentId,
              label: "",
              resolutionToken: "",
              targetKind: "document",
              url: target.href,
              version: 1,
            }),
          subtext: target.kind === "journal" ? "Journal entry" : "Page",
          title: target.title,
        }));
      }}
    />
  );
}

/**
 * Button to add a block selection.
 */
function BlockEditorSelectionButton() {
  const isMobile = useIsMobile();
  const editor = useBlockNoteEditor(schema);
  const Components = useComponentsContext();
  const { setSelection, getSelection, unsetSelection } = useJournlAgent();

  // Doesn't render unless a at least one block with inline content is selected.
  const blocks = useSelectedBlocks<
    typeof schema.blockSchema,
    typeof schema.inlineContentSchema,
    typeof schema.styleSchema
  >() as BlockPrimitive[];

  if (
    !Components ||
    blocks.filter((block) => block.content !== undefined).length === 0
  ) {
    return null;
  }

  const selection = getSelection({
    blockIds: new Set(blocks.map((block) => block.id)),
    editor,
  });

  function onClick() {
    if (!selection) {
      const markdown = selectionMarkdown(blocks);
      setSelection({
        blockIds: new Set(blocks.map((block) => block.id)),
        blocks,
        editor,
        markdown,
        text: removeMarkdown(markdown).trim(),
      });
    } else {
      unsetSelection(selection);
    }
  }

  const text = selection ? "Remove from Chat" : "Add to Chat";

  return (
    <Components.FormattingToolbar.Button
      label={text}
      mainTooltip={text}
      onClick={onClick}
      isSelected={Boolean(selection)}
      className="shrink-0"
    >
      {isMobile ? (
        selection ? (
          <Unlink aria-hidden="true" />
        ) : (
          <MessageSquarePlus aria-hidden="true" />
        )
      ) : (
        text
      )}
    </Components.FormattingToolbar.Button>
  );
}

function selectionMarkdown(blocks: BlockPrimitive[]) {
  const markdown: string[] = [];

  for (const block of blocks) {
    if (!Array.isArray(block.content)) continue;
    const blockMarkdown = block.content
      .filter((c) => "text" in c)
      .map((c) => c.text)
      .join("\n");
    markdown.push(blockMarkdown);
  }

  return markdown.join("\n");
}
