import {
  type DocumentBlock,
  type InlineContent,
  parseBlock,
} from "@acme/document";
import { Fragment, type ResolvedPos, Slice } from "@tiptap/pm/model";
import type { PhrasingContent, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { IdFactory } from "../engine/identity";
import { safeEditorUrl } from "../engine/schema";
import { toTiptapDocument } from "./tiptap";

type Text = {
  type: "text";
  text: string;
  styles: { bold?: boolean; italic?: boolean; code?: boolean };
};

/** CommonMark parsing belongs to micromark/remark's parser. This adapter only
 * maps supported syntax into Journl blocks; raw HTML is inert authored text. */
export function markdownClipboard(
  text: string,
  context: ResolvedPos,
  createId: IdFactory,
): Slice {
  const schema = context.doc.type.schema;
  // Single-line input, code and table cells keep their literal text semantics.
  if (
    !/[\r\n]/.test(text) ||
    ["codeBlock", "tableParagraph"].includes(context.parent.type.name)
  ) {
    return new Slice(
      text ? Fragment.from(schema.text(text, context.marks())) : Fragment.empty,
      0,
      0,
    );
  }
  const raw = (node: {
    position?: { start: { offset?: number }; end: { offset?: number } };
  }) =>
    text.slice(
      node.position?.start.offset ?? 0,
      node.position?.end.offset ?? text.length,
    );
  const inlines = (
    nodes: PhrasingContent[],
    styles: Text["styles"] = {},
  ): Exclude<InlineContent, string> =>
    nodes.flatMap((node): Exclude<InlineContent, string> => {
      switch (node.type) {
        case "text":
          return [{ styles, text: node.value, type: "text" }];
        case "break":
          return [{ styles, text: "\n", type: "text" }];
        case "inlineCode":
          return [
            {
              styles: { ...styles, code: true },
              text: node.value,
              type: "text",
            },
          ];
        case "strong":
          return inlines(node.children, { ...styles, bold: true });
        case "emphasis":
          return inlines(node.children, { ...styles, italic: true });
        case "link": {
          const content = inlines(node.children, styles).flatMap(
            (item): Text[] =>
              typeof item === "object" && item.type === "text" ? [item] : [],
          );
          return safeEditorUrl(node.url)
            ? [{ content, href: node.url, type: "link" }]
            : content;
        }
        default:
          return [{ styles, text: raw(node), type: "text" }];
      }
    });
  const block = (data: Omit<DocumentBlock, "id">) =>
    parseBlock({ ...data, id: createId() });
  const blocks = (nodes: RootContent[]): DocumentBlock[] =>
    nodes.flatMap((node): DocumentBlock[] => {
      switch (node.type) {
        case "paragraph":
          return [
            block({ content: inlines(node.children), type: "paragraph" }),
          ];
        case "heading":
          return [
            block({
              content: inlines(node.children),
              props: { level: node.depth },
              type: "heading",
            }),
          ];
        case "code":
          return [
            block({
              content: node.value,
              props: { language: node.lang || "auto" },
              type: "codeBlock",
            }),
          ];
        case "thematicBreak":
          return [block({ type: "divider" })];
        case "blockquote":
          return blocks(node.children).map((item) =>
            item.type === "paragraph"
              ? parseBlock({ ...item, type: "quote" })
              : item,
          );
        case "list":
          return node.children.map((item, index) => {
            const [first, ...rest] = item.children;
            return block({
              type: node.ordered ? "numberedListItem" : "bulletListItem",
              ...(node.ordered
                ? { props: { start: (node.start ?? 1) + index } }
                : {}),
              children: blocks(
                first?.type === "paragraph" ? rest : item.children,
              ),
              content:
                first?.type === "paragraph" ? inlines(first.children) : [],
            });
          });
        case "definition":
          return [];
        default:
          return [block({ content: raw(node), type: "paragraph" })];
      }
    });
  const result = blocks(fromMarkdown(text).children);
  return new Slice(toTiptapDocument(result, schema).content, 0, 0);
}
