import { type Extensions, Mark, Node } from "@tiptap/core";

export const inlineBlockTypes = [
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "quote",
] as const;
export const atomBlockTypes = [
  "divider",
  "image",
  "video",
  "audio",
  "file",
  "referenceCard",
  "contentEmbed",
] as const;

const parseAttrs = (element: HTMLElement) => {
  const value = element.getAttribute("data-journl-attrs");
  return value ? JSON.parse(value) : null;
};
const htmlAttrs = (attrs: Record<string, unknown>) => ({
  "data-journl-attrs": JSON.stringify(attrs),
});

const propsAttribute = () => ({
  props: { default: null, rendered: false },
});

/** Each Journl block has one identity, one body, and an optional child group. */
export function documentExtensions(): Extensions {
  return [
    Node.create({ name: "doc", topNode: true, content: "journlBlock*" }),
    Node.create({ name: "text", group: "inline" }),
    Node.create({
      name: "journlBlock",
      content: "journlBody journlChildren?",
      defining: true,
      addAttributes: () => ({
        id: { default: null, keepOnSplit: false, rendered: false },
      }),
      parseHTML: () => [
        {
          tag: "div[data-journl-block]",
          getAttrs: (element) => ({
            id: element.getAttribute("data-block-id"),
          }),
        },
      ],
      renderHTML: ({ node }) => [
        "div",
        {
          "data-journl-block": "",
          "data-block-id": node.attrs.id,
        },
        0,
      ],
    }),
    Node.create({
      name: "journlChildren",
      content: "journlBlock*",
      defining: true,
      parseHTML: () => [{ tag: "div[data-journl-children]" }],
      renderHTML: () => ["div", { "data-journl-children": "" }, 0],
    }),
    ...inlineBlockTypes.map((name) =>
      Node.create({
        name,
        group: "journlBody",
        content: "inline*",
        addAttributes: propsAttribute,
        parseHTML: () => [
          {
            tag: `[data-journl-body="${name}"]`,
            getAttrs: parseAttrs,
            preserveWhitespace: "full",
          },
        ],
        renderHTML: ({ node }) => [
          name === "quote" ? "blockquote" : "p",
          {
            "data-journl-body": name,
            ...htmlAttrs(node.attrs),
          },
          0,
        ],
      }),
    ),
    Node.create({
      name: "codeBlock",
      group: "journlBody",
      content: "text*",
      marks: "",
      code: true,
      addAttributes: propsAttribute,
      parseHTML: () => [
        { tag: "pre", preserveWhitespace: "full", getAttrs: parseAttrs },
      ],
      renderHTML: ({ node }) => ["pre", htmlAttrs(node.attrs), ["code", 0]],
    }),
    ...atomBlockTypes.map((name) =>
      Node.create({
        name,
        group: "journlBody",
        atom: true,
        addAttributes: propsAttribute,
        parseHTML: () => [
          { tag: `[data-journl-body="${name}"]`, getAttrs: parseAttrs },
        ],
        renderHTML: ({ node }) => [
          "div",
          { "data-journl-body": name, ...htmlAttrs(node.attrs) },
          name === "divider"
            ? "—"
            : String(
                node.attrs.props?.label ??
                  node.attrs.props?.caption ??
                  node.attrs.props?.name ??
                  name,
              ),
        ],
      }),
    ),
    Node.create({
      name: "table",
      group: "journlBody",
      content: "tableRow*",
      isolating: true,
      addAttributes: () => ({
        ...propsAttribute(),
        columnWidths: { default: null, rendered: false },
        headerRows: { default: null, rendered: false },
        headerCols: { default: null, rendered: false },
        contentPresent: { default: true, rendered: false },
      }),
      parseHTML: () => [{ tag: "table", getAttrs: parseAttrs }],
      renderHTML: ({ node }) => ["table", htmlAttrs(node.attrs), ["tbody", 0]],
    }),
    Node.create({
      name: "tableRow",
      content: "tableCell*",
      addAttributes: () => ({ legacy: { default: false, rendered: false } }),
      parseHTML: () => [{ tag: "tr", getAttrs: parseAttrs }],
      renderHTML: ({ node }) => ["tr", htmlAttrs(node.attrs), 0],
    }),
    Node.create({
      name: "tableCell",
      content: "inline*",
      isolating: true,
      addAttributes: propsAttribute,
      parseHTML: () => [
        { tag: "td", getAttrs: parseAttrs, preserveWhitespace: "full" },
      ],
      renderHTML: ({ node }) => [
        "td",
        {
          ...htmlAttrs(node.attrs),
          colspan: node.attrs.props?.colspan ?? 1,
          rowspan: node.attrs.props?.rowspan ?? 1,
        },
        0,
      ],
    }),
    Node.create({
      name: "contentReference",
      group: "inline",
      inline: true,
      atom: true,
      addAttributes: propsAttribute,
      parseHTML: () => [
        { tag: "span[data-journl-reference]", getAttrs: parseAttrs },
      ],
      renderHTML: ({ node }) => [
        "span",
        { "data-journl-reference": "", ...htmlAttrs(node.attrs) },
        String(node.attrs.props?.label ?? "Reference"),
      ],
    }),
    ...(["bold", "italic", "underline", "strike", "code"] as const).map(
      (name) => {
        const tag = {
          bold: "strong",
          italic: "em",
          underline: "u",
          strike: "s",
          code: "code",
        }[name];
        return Mark.create({
          name,
          excludes: "",
          parseHTML: () => [{ tag }],
          renderHTML: () => [tag, 0],
        });
      },
    ),
    ...(["textColor", "backgroundColor"] as const).map((name) =>
      Mark.create({
        name,
        excludes: "",
        parseHTML: () => [
          { tag: `span[data-journl-style="${name}"]`, getAttrs: parseAttrs },
        ],
        addAttributes: () => ({
          value: { default: "default", rendered: false },
        }),
        renderHTML: ({ mark }) => [
          "span",
          {
            "data-journl-style": name,
            ...htmlAttrs(mark.attrs),
            style: `${name === "textColor" ? "color" : "background-color"}: ${mark.attrs.value}`,
          },
          0,
        ],
      }),
    ),
    Mark.create({
      name: "link",
      inclusive: false,
      addAttributes: () => ({ href: { default: "", rendered: false } }),
      parseHTML: () => [
        { tag: "span[data-journl-link]", getAttrs: parseAttrs },
      ],
      // Links are rendered as text here; the app supplies guarded navigation.
      renderHTML: ({ mark }) => [
        "span",
        { "data-journl-link": "", ...htmlAttrs(mark.attrs) },
        0,
      ],
    }),
  ];
}
