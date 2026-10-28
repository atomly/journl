import { Extension, type Extensions, Mark, Node } from "@tiptap/core";
import { blockView } from "./block-view";
import { codeHighlightPlugin } from "./code-block";
import { editorColor as color } from "./colors";
import { tableExtension, tableNodeView } from "./tables";

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
const textStyle = (props: Record<string, unknown> | null) =>
  `text-align:${props?.textAlignment ?? "left"};${props?.textColor && props.textColor !== "default" ? `color:${color(props.textColor)};` : ""}background-color:${color(props?.backgroundColor, true)}`;
const parseAttrs = (element: HTMLElement) => {
  const value = element.getAttribute("data-openeditor-attrs");
  return value ? JSON.parse(value) : null;
};
const htmlAttrs = (attrs: Record<string, unknown>) => ({
  "data-openeditor-attrs": JSON.stringify(attrs),
});

const propsAttribute = () => ({
  props: { default: null, rendered: false },
});

/** Each Journl block has one identity, one body, and an optional child group. */
export function documentExtensions(): Extensions {
  return [
    tableExtension(),
    Extension.create({
      name: "journlSyntaxHighlight",
      addProseMirrorPlugins: () => [codeHighlightPlugin()],
    }),
    Node.create({ name: "doc", topNode: true, content: "journlBlock*" }),
    Node.create({ name: "text", group: "inline" }),
    Node.create({
      name: "journlBlock",
      addNodeView: () => blockView,
      draggable: true,
      content: "journlBody journlChildren?",
      defining: true,
      addAttributes: () => ({
        id: { default: null, keepOnSplit: false, rendered: false },
      }),
      parseHTML: () => [
        {
          tag: "div[data-openeditor-block]",
          getAttrs: (element) => ({
            id: element.getAttribute("data-block-id"),
          }),
        },
      ],
      renderHTML: ({ node }) => [
        "div",
        {
          "data-openeditor-block": "",
          "data-block-id": node.attrs.id,
        },
        0,
      ],
    }),
    Node.create({
      name: "journlChildren",
      content: "journlBlock*",
      defining: true,
      parseHTML: () => [{ tag: "div[data-openeditor-children]" }],
      renderHTML: () => ["div", { "data-openeditor-children": "" }, 0],
    }),
    ...inlineBlockTypes.map((name) =>
      Node.create({
        name,
        group: "journlBody",
        content: "inline*",
        addAttributes: propsAttribute,
        parseHTML: () => [
          {
            tag: `[data-openeditor-body="${name}"]`,
            getAttrs: parseAttrs,
            preserveWhitespace: "full",
          },
          ...(name === "paragraph"
            ? [
                {
                  tag: "p:not([data-openeditor-body])",
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
            "data-openeditor-body": name,
            style: textStyle(node.attrs.props),
            "data-heading-level":
              name === "heading" ? (node.attrs.props?.level ?? 1) : undefined,
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
      renderHTML: ({ node }) => [
        "pre",
        { "data-openeditor-body": "codeBlock", ...htmlAttrs(node.attrs) },
        ["code", 0],
      ],
    }),
    ...atomBlockTypes.map((name) =>
      Node.create({
        name,
        group: "journlBody",
        atom: true,
        addAttributes: propsAttribute,
        parseHTML: () => [
          { tag: `[data-openeditor-body="${name}"]`, getAttrs: parseAttrs },
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
          const attrs = {
            "data-openeditor-body": name,
            ...htmlAttrs(node.attrs),
          };
          const url = safeEditorUrl(props.url ?? "");
          if (name === "divider") return ["div", attrs, ["hr"]];
          if (["image", "video", "audio", "file"].includes(name)) {
            const caption = ["figcaption", {}, props.caption ?? ""];
            const preview = props.showPreview !== false && name !== "file";
            return [
              "figure",
              {
                ...attrs,
                style: `text-align:${props.textAlignment ?? "left"}`,
              },
              preview
                ? name === "image"
                  ? [
                      "img",
                      {
                        src: url,
                        alt: props.caption || props.name || "Image",
                        width: props.previewWidth,
                        style: `max-width:100%;${props.textAlignment === "center" ? "margin-inline:auto" : props.textAlignment === "right" ? "margin-left:auto" : ""}`,
                      },
                    ]
                  : [
                      name,
                      {
                        src: url,
                        controls: "",
                        preload: "none",
                        width: props.previewWidth,
                      },
                    ]
                : [
                    "a",
                    {
                      href: url,
                      class: "openeditor-file-link",
                      rel: "noopener noreferrer",
                      target: "_blank",
                    },
                    [
                      "http://www.w3.org/2000/svg svg",
                      {
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": "1.7",
                        width: "24",
                        height: "24",
                        "aria-hidden": "true",
                      },
                      [
                        "http://www.w3.org/2000/svg path",
                        {
                          d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6",
                        },
                      ],
                    ],
                    props.name || name.charAt(0).toUpperCase() + name.slice(1),
                  ],
              caption,
            ];
          }
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
      addNodeView: () => tableNodeView,
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
      renderHTML: ({ node }) => [
        "table",
        {
          "data-openeditor-body": "table",
          ...htmlAttrs(node.attrs),
          style: textStyle(node.attrs.props),
        },
        [
          "colgroup",
          ...(
            node.attrs.columnWidths ??
            Array(node.firstChild?.childCount ?? 0).fill(null)
          ).map((width: number | null) => [
            "col",
            { style: `width:${width ?? 200}px` },
          ]),
        ],
        ["tbody", 0],
      ],
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
      content: "tableParagraph+",
      isolating: true,
      addAttributes: () => ({
        ...propsAttribute(),
        colspan: { default: 1, rendered: false },
        rowspan: { default: 1, rendered: false },
        colwidth: { default: null, rendered: false },
      }),
      parseHTML: () => [
        { tag: "td", getAttrs: parseAttrs, preserveWhitespace: "full" },
      ],
      renderHTML: ({ node }) => [
        "td",
        {
          ...htmlAttrs(node.attrs),
          style: textStyle(node.attrs.props),
          colspan: node.attrs.colspan,
          rowspan: node.attrs.rowspan,
        },
        0,
      ],
    }),
    Node.create({
      name: "tableParagraph",
      priority: 1100,
      content: "inline*",
      parseHTML: () => [{ tag: "p[data-table-paragraph]" }],
      renderHTML: () => ["p", { "data-table-paragraph": "" }, 0],
    }),
    Node.create({
      name: "contentReference",
      group: "inline",
      inline: true,
      atom: true,
      addAttributes: propsAttribute,
      parseHTML: () => [
        { tag: "span[data-openeditor-reference]", getAttrs: parseAttrs },
      ],
      renderHTML: ({ node }) => [
        "span",
        { "data-openeditor-reference": "", ...htmlAttrs(node.attrs) },
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
          {
            tag: `span[data-openeditor-style="${name}"]`,
            getAttrs: parseAttrs,
          },
        ],
        addAttributes: () => ({
          value: { default: "default", rendered: false },
        }),
        renderHTML: ({ mark }) => [
          "span",
          {
            "data-openeditor-style": name,
            ...htmlAttrs(mark.attrs),
            style: `${name === "textColor" ? "color" : "background-color"}: ${color(mark.attrs.value, name === "backgroundColor")}`,
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
        { tag: "[data-openeditor-link]", getAttrs: parseAttrs },
        {
          tag: "a[href]",
          getAttrs: (element) => ({ href: element.getAttribute("href") ?? "" }),
        },
      ],
      // The app handles internal navigation; unsafe authored schemes remain text.
      renderHTML: ({ mark }) => [
        "a",
        {
          "data-openeditor-link": "",
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
