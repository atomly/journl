import { Extension, type Extensions, Node } from "@tiptap/core";
import { referenceSelectionPlugin } from "./reference-selection";
import { safeEditorUrl } from "./schema";
import { htmlAttrs, parseAttrs, propsAttribute } from "./schema-attributes";

/** Optional authored reference nodes and their selection behavior. */
export function referenceExtensions(): Extensions {
  return [
    Extension.create({
      name: "better-editor-references",
      addProseMirrorPlugins: () => [referenceSelectionPlugin()],
    }),
    ...["referenceCard", "contentEmbed"].map((name) =>
      Node.create({
        name,
        group: "betterEditorBody",
        atom: true,
        addAttributes: propsAttribute,
        parseHTML: () => [
          { tag: `[data-better-editor-body="${name}"]`, getAttrs: parseAttrs },
        ],
        renderHTML: ({ node }) => {
          const props = node.attrs.props ?? {};
          const url = safeEditorUrl(props.url ?? "");
          return [
            "div",
            { "data-better-editor-body": name, ...htmlAttrs(node.attrs) },
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
      name: "contentReference",
      group: "inline",
      inline: true,
      atom: true,
      addAttributes: propsAttribute,
      parseHTML: () => [
        { tag: "span[data-better-editor-reference]", getAttrs: parseAttrs },
      ],
      renderHTML: ({ node }) => [
        "span",
        { "data-better-editor-reference": "", ...htmlAttrs(node.attrs) },
        String(node.attrs.props?.label || node.attrs.props?.url || "Reference"),
      ],
    }),
  ];
}
