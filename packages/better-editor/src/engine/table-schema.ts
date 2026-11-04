import { type Extensions, Node } from "@tiptap/core";
import {
  htmlAttrs,
  parseAttrs,
  propsAttribute,
  textStyle,
} from "./schema-attributes";
import { tableExtension } from "./tables";

/** Optional table schema and editing plugins, without DOM presentation. */
export function tableExtensions(): Extensions {
  return [
    tableExtension(),
    Node.create({
      name: "table",
      group: "betterEditorBody",
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
          "data-better-editor-body": "table",
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
  ];
}
