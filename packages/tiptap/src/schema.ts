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

export function safeEditorUrl(value: string): string {
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(value) &&
    !/[\s]/.test(value) &&
    ![...value].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
    ? value
    : "";
}
const color = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9#(),.% -]+$/.test(value)
    ? value
    : "inherit";
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
      draggable: true,
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
          ...(name === "paragraph"
            ? [
                {
                  tag: "p:not([data-journl-body])",
                  preserveWhitespace: "full" as const,
                },
              ]
            : []),
          ...(name === "heading"
            ? [1, 2, 3, 4, 5, 6].map((level) => ({
                tag: `h${level}`,
                preserveWhitespace: "full" as const,
                getAttrs: () => ({ props: { level } }),
              }))
            : []),
        ],
        renderHTML: ({ node }) => [
          name === "quote"
            ? "blockquote"
            : name === "heading"
              ? `h${node.attrs.props?.level ?? 1}`
              : "p",
          {
            "data-journl-body": name,
            style: `text-align:${node.attrs.props?.textAlignment ?? "left"};color:${color(node.attrs.props?.textColor)};background-color:${color(node.attrs.props?.backgroundColor)}`,
            "data-checked": node.attrs.props?.checked ? "true" : "false",
            "data-start": node.attrs.props?.start ?? 1,
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
          ...(["image", "video", "audio"].includes(name)
            ? [
                {
                  tag: `${name === "image" ? "img" : name}[src]`,
                  getAttrs: (element: HTMLElement) => ({
                    props: {
                      url: element.getAttribute("src") ?? "",
                      ...(name === "image"
                        ? { caption: element.getAttribute("alt") ?? "" }
                        : {}),
                    },
                  }),
                },
              ]
            : []),
        ],
        renderHTML: ({ node }) => {
          const props = node.attrs.props ?? {};
          const attrs = { "data-journl-body": name, ...htmlAttrs(node.attrs) };
          const url = safeEditorUrl(props.url ?? "");
          if (name === "divider") return ["div", attrs, ["hr"]];
          if (name === "image")
            return [
              "figure",
              attrs,
              [
                "img",
                {
                  src: url,
                  alt: props.caption || props.name || "Image",
                  width: props.previewWidth,
                },
              ],
              ["figcaption", {}, props.caption ?? ""],
            ];
          if (name === "video" || name === "audio")
            return [
              "figure",
              attrs,
              [name, { src: url, controls: "", preload: "none" }],
              ["figcaption", {}, props.caption ?? props.name ?? ""],
            ];
          return [
            "div",
            attrs,
            [
              "a",
              { ...(url ? { href: url } : {}), rel: "noopener noreferrer" },
              props.label ||
                props.caption ||
                props.name ||
                props.url ||
                "Reference",
            ],
          ];
        },
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
        String(node.attrs.props?.label || node.attrs.props?.url || "Reference"),
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
        { tag: "[data-journl-link]", getAttrs: parseAttrs },
        {
          tag: "a[href]",
          getAttrs: (element) => ({ href: element.getAttribute("href") ?? "" }),
        },
      ],
      // The app handles internal navigation; unsafe authored schemes remain text.
      renderHTML: ({ mark }) => [
        "a",
        {
          "data-journl-link": "",
          ...(safeEditorUrl(mark.attrs.href)
            ? { href: safeEditorUrl(mark.attrs.href) }
            : {}),
          ...htmlAttrs(mark.attrs),
        },
        0,
      ],
    }),
  ];
}
