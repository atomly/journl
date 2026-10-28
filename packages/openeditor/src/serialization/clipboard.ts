import { documentMarkdown } from "@acme/document";
import type { Fragment, Node } from "@tiptap/pm/model";
import { fromTiptapDocument } from "./tiptap";

/** Only the copied slice is serialized. Rich HTML stays untouched; plain text
 * keeps familiar list markers, nesting and link labels for ordinary inputs. */
export function clipboardText(content: Fragment): string {
  const parts: string[] = [];
  content.forEach((node: Node) => {
    if (node.type.name === "journlBlock") {
      const blocks = fromTiptapDocument(
        node.type.schema.topNodeType.create(null, node),
      );
      parts.push(documentMarkdown(blocks));
    } else if (node.type.name === "contentReference") {
      parts.push(
        node.attrs.props?.label || node.attrs.props?.url || "Reference",
      );
    } else if (node.type.name === "tableRow") {
      const cells: string[] = [];
      node.forEach((cell) => {
        cells.push(clipboardText(cell.content));
      });
      parts.push(cells.join("\t"));
    } else if (node.isText) parts.push(node.text ?? "");
    else parts.push(clipboardText(node.content));
  });
  // Inline fragments must not gain line breaks between individual marks.
  return parts.join(content.firstChild?.isInline ? "" : "\n");
}
