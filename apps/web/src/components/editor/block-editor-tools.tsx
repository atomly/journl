"use client";

import {
  type BlockPrimitive,
  type EditorPrimitive,
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
  useExtension,
  useSelectedBlocks,
} from "@blocknote/react";
import {
  AIExtension,
  getAISlashMenuItems,
  useAIDictionary,
} from "@blocknote/xl-ai";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Link2, MessageSquarePlus, Unlink } from "lucide-react";
import { useState } from "react";
import { RiSparkling2Fill } from "react-icons/ri";
import removeMarkdown from "remove-markdown";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { useIsMobile } from "~/hooks/use-mobile";
import { useTRPC } from "~/trpc/react";

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
          <BlockEditorConvertLinkButton />
          {getFormattingToolbarItems()}
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
            <BlockEditorConvertLinkButton />
          </>
        )}
        {getFormattingToolbarItems()}
      </FormattingToolbar>
    </div>
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

function BlockEditorConvertLinkButton() {
  const editor = useBlockNoteEditor(schema);
  const Components = useComponentsContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [converted, setConverted] = useState(false);
  const tiptap = editor._tiptapEditor;
  const selection = tiptap.state.selection;
  if (!Components || selection.empty) return null;
  const linkMark = tiptap.schema.marks.link;
  const link = selection.$from.marks().find((mark) => mark.type === linkMark);
  const label = tiptap.state.doc.textBetween(
    selection.from,
    selection.to,
    "",
    "",
  );
  const href = typeof link?.attrs.href === "string" ? link.attrs.href : "";
  if (!link || !href || !label.trim()) return null;

  const captured = {
    from: selection.from,
    href,
    label,
    to: selection.to,
  };
  async function convertLink() {
    try {
      const { items } = await queryClient.fetchQuery(
        trpc.references.resolveUrls.queryOptions({ urls: [captured.href] }),
      );
      const resolved = items[0];
      if (!resolved?.target) return;
      const current = editor._tiptapEditor.state.selection;
      const currentLink = current.$from
        .marks()
        .find((mark) => mark.type === editor._tiptapEditor.schema.marks.link);
      if (
        current.from !== captured.from ||
        current.to !== captured.to ||
        editor._tiptapEditor.state.doc.textBetween(
          current.from,
          current.to,
          "",
          "",
        ) !== captured.label ||
        currentLink?.attrs.href !== captured.href
      )
        return;
      const target = resolved.target;
      editor.insertInlineContent([
        {
          props: {
            blockId: target.kind === "document" ? (target.blockId ?? "") : "",
            documentId: target.kind === "document" ? target.documentId : "",
            label: captured.label,
            resolutionToken: "",
            targetKind: target.kind,
            url:
              target.kind === "external"
                ? target.url
                : resolved.preview.status === "ready"
                  ? (resolved.preview.href ?? captured.href)
                  : captured.href,
            version: 1,
          },
          type: "contentReference",
        },
      ]);
      setConverted(true);
      window.setTimeout(() => setConverted(false), 1500);
    } catch {
      // A failed resolver leaves the selected link intact for a later retry.
    }
  }

  return (
    <Components.FormattingToolbar.Button
      label="Convert link to reference badge"
      mainTooltip={
        converted
          ? "Link converted to reference"
          : "Convert link to reference badge"
      }
      onClick={() => void convertLink()}
      className="shrink-0"
    >
      {converted ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
    </Components.FormattingToolbar.Button>
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
