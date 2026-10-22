import {
  type DocumentBlock,
  documentRows,
  type InlineContent,
  parseBlock,
  type TableContent,
} from "@acme/document";
import { getSchema } from "@tiptap/core";
import type { Mark, Node, Schema } from "@tiptap/pm/model";
import { required } from "./required";
import { documentExtensions } from "./schema";

export function documentSchema(): Schema {
  return getSchema(documentExtensions());
}

/** Failed loads retain independent input; never return a partially normalized doc. */
export class AdapterReadError extends Error {
  readonly original: unknown;
  constructor(original: unknown, cause: unknown) {
    super("Document cannot be opened by the Tiptap adapter", { cause });
    this.name = "AdapterReadError";
    this.original = structuredClone(original);
  }
}

function textMarks(styles: Record<string, unknown>, schema: Schema): Mark[] {
  return Object.entries(styles).flatMap(([key, value]) => {
    if (!value) return [];
    const type = schema.marks[key];
    if (!type) throw new Error(`Unsupported text style: ${key}`);
    return [type.create(typeof value === "string" ? { value } : undefined)];
  });
}
function inlineNodes(
  content: InlineContent | undefined,
  schema: Schema,
): Node[] {
  if (content === undefined) return [];
  if (typeof content === "string") return content ? [schema.text(content)] : [];
  return content.flatMap((item): Node[] => {
    if (typeof item === "string") return inlineNodes(item, schema);
    if (item.type === "text")
      return item.text
        ? [schema.text(item.text, textMarks(item.styles, schema))]
        : [];
    if (item.type === "contentReference")
      return [
        required(schema.nodes.contentReference).create({ props: item.props }),
      ];
    const link = required(schema.marks.link).create({ href: item.href });
    return inlineNodes(item.content, schema).map((node) =>
      node.mark([...node.marks, link]),
    );
  });
}
function tableRows(content: TableContent | undefined, schema: Schema): Node[] {
  return (content?.rows ?? []).map((row) => {
    const legacy = row.cells.every(
      (cell) => typeof cell === "string" || Array.isArray(cell),
    );
    return required(schema.nodes.tableRow).createChecked(
      { legacy },
      row.cells.map((cell) => {
        const structured = typeof cell === "object" && !Array.isArray(cell);
        return required(schema.nodes.tableCell).createChecked(
          { props: structured ? (cell.props ?? null) : null },
          inlineNodes(structured ? cell.content : cell, schema),
        );
      }),
    );
  });
}

export function toTiptapDocument(
  input: readonly DocumentBlock[],
  schema = documentSchema(),
): Node {
  try {
    const blocks = input.map(parseBlock);
    documentRows(blocks);
    const convert = (block: DocumentBlock): Node => {
      let body: Node;
      const attrs = { props: block.props ?? null };
      if (block.type === "table") {
        body = required(schema.nodes.table).createChecked(
          {
            ...attrs,
            columnWidths:
              block.content?.columnWidths?.map((width) => width ?? null) ??
              null,
            contentPresent: block.content !== undefined,
            headerCols: block.content?.headerCols ?? null,
            headerRows: block.content?.headerRows ?? null,
          },
          tableRows(block.content, schema),
        );
      } else if (block.type === "codeBlock") {
        const text =
          typeof block.content === "string"
            ? block.content
            : (block.content ?? [])
                .map((item) => (typeof item === "string" ? item : item.text))
                .join("");
        body = required(schema.nodes.codeBlock).createChecked(
          attrs,
          text ? schema.text(text) : undefined,
        );
      } else {
        const type = schema.nodes[block.type];
        if (!type) throw new Error(`Unsupported block: ${block.type}`);
        body = type.createChecked(
          attrs,
          "content" in block ? inlineNodes(block.content, schema) : undefined,
        );
      }
      return required(schema.nodes.journlBlock).createChecked(
        { id: block.id },
        [
          body,
          ...(!block.children?.length
            ? []
            : [
                required(schema.nodes.journlChildren).createChecked(
                  null,
                  block.children.map(convert),
                ),
              ]),
        ],
      );
    };
    const result = schema.topNodeType.createChecked(null, blocks.map(convert));
    result.check();
    return result;
  } catch (cause) {
    throw new AdapterReadError(input, cause);
  }
}

function readInline(node: Node): InlineContent {
  const result: Exclude<InlineContent, string> = [];
  node.forEach((child) => {
    if (child.type.name === "contentReference") {
      if (child.marks.length)
        throw new Error(
          "Reference marks are not supported by the document contract",
        );
      result.push({
        props: structuredClone(child.attrs.props),
        type: "contentReference",
      });
      return;
    }
    if (!child.isText)
      throw new Error(`Unsupported inline node: ${child.type.name}`);
    const styles: Record<string, boolean | string> = {};
    const link = child.marks.find((mark) => mark.type.name === "link");
    for (const mark of child.marks) {
      if (mark.type.name === "link") continue;
      styles[mark.type.name] = mark.attrs.value ?? true;
    }
    const text = { styles, text: child.text ?? "", type: "text" as const };
    if (link) {
      const previous = result.at(-1);
      if (
        typeof previous === "object" &&
        previous.type === "link" &&
        previous.href === link.attrs.href &&
        Array.isArray(previous.content)
      )
        previous.content.push(text);
      else
        result.push({ content: [text], href: link.attrs.href, type: "link" });
    } else result.push(text);
  });
  return result;
}

export function fromTiptapDocument(doc: Node): DocumentBlock[] {
  try {
    doc.check();
    if (doc.type.name !== "doc") throw new Error("Expected document root");
    const convert = (wrapper: Node): DocumentBlock => {
      if (wrapper.type.name !== "journlBlock")
        throw new Error("Expected Journl block wrapper");
      const body = required(wrapper.firstChild);
      const type = body.type.name;
      const data: Record<string, unknown> = { id: wrapper.attrs.id, type };
      if (body.attrs.props !== null)
        data.props = structuredClone(body.attrs.props);
      if (type === "table") {
        if (body.attrs.contentPresent || body.childCount) {
          const rows: TableContent["rows"] = [];
          body.forEach((row) => {
            const cells: Extract<
              TableContent["rows"][number]["cells"][number],
              { type: "tableCell" }
            >[] = [];
            const legacyCells: InlineContent[] = [];
            row.forEach((cell) => {
              const content = readInline(cell);
              cells.push({
                content,
                type: "tableCell",
                ...(cell.attrs.props === null
                  ? {}
                  : { props: structuredClone(cell.attrs.props) }),
              });
              legacyCells.push(content);
            });
            rows.push({
              cells:
                row.attrs.legacy && cells.every((cell) => !cell.props)
                  ? legacyCells
                  : cells,
            });
          });
          data.content = {
            rows,
            type: "tableContent",
            ...Object.fromEntries(
              ["columnWidths", "headerRows", "headerCols"]
                .filter((key) => body.attrs[key] !== null)
                .map((key) => [key, structuredClone(body.attrs[key])]),
            ),
          };
        }
      } else if (type === "codeBlock") data.content = body.textContent;
      else if (body.isTextblock) data.content = readInline(body);
      if (wrapper.childCount === 2) {
        const children: DocumentBlock[] = [];
        wrapper.child(1).forEach((child) => {
          children.push(convert(child));
        });
        data.children = children;
      }
      return parseBlock(data);
    };
    const result: DocumentBlock[] = [];
    doc.forEach((node) => {
      result.push(convert(node));
    });
    documentRows(result);
    return result;
  } catch (cause) {
    throw new AdapterReadError(doc.toJSON(), cause);
  }
}
