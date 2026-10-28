import {
  type DocumentBlock,
  documentRows,
  type InlineContent,
  parseBlock,
  type TableContent,
} from "@acme/document";
import { getSchema } from "@tiptap/core";
import { Fragment, type Mark, type Node, type Schema } from "@tiptap/pm/model";
import { TableMap } from "@tiptap/pm/tables";
import { required } from "../engine/required";
import { documentExtensions } from "../engine/schema";

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
          {
            colspan: structured ? (cell.props?.colspan ?? 1) : 1,
            colwidth: null,
            props: structured ? (cell.props ?? null) : null,
            rowspan: structured ? (cell.props?.rowspan ?? 1) : 1,
          },
          required(schema.nodes.tableParagraph).createChecked(
            null,
            inlineNodes(structured ? cell.content : cell, schema),
          ),
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
        const map = TableMap.get(body);
        const rows: Node[] = [];
        body.forEach((row, rowOffset) => {
          const cells: Node[] = [];
          row.forEach((cell, cellOffset) => {
            const left = map.findCell(rowOffset + 1 + cellOffset).left;
            const widths = Array.from(
              { length: cell.attrs.colspan },
              (_, i) => block.content?.columnWidths?.[left + i] ?? 0,
            );
            cells.push(
              cell.type.create(
                {
                  ...cell.attrs,
                  colwidth: widths.some(Boolean) ? widths : null,
                },
                cell.content,
              ),
            );
          });
          rows.push(row.copy(Fragment.fromArray(cells)));
        });
        body = body.copy(Fragment.fromArray(rows));
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
      return required(schema.nodes.openEditorBlock).createChecked(
        { id: block.id },
        [
          body,
          ...(!block.children?.length
            ? []
            : [
                required(schema.nodes.openEditorChildren).createChecked(
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

function readInline(node: Node): Exclude<InlineContent, string> {
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
      if (wrapper.type.name !== "openEditorBlock")
        throw new Error("Expected OpenEditor block wrapper");
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
              // The editor library may concatenate paragraphs when merging cells.
              // OpenEditor cells own inline content, so retain paragraph boundaries as newlines.
              const content: Exclude<InlineContent, string> = [];
              cell.forEach((paragraph, _offset, index) => {
                if (index)
                  content.push({ styles: {}, text: "\n", type: "text" });
                content.push(...readInline(paragraph));
              });
              const props = { ...cell.attrs.props };
              for (const key of ["colspan", "rowspan"] as const)
                if (cell.attrs[key] !== (props[key] ?? 1))
                  props[key] = cell.attrs[key];
              cells.push({
                content,
                type: "tableCell",
                ...(cell.attrs.props === null && !Object.keys(props).length
                  ? {}
                  : { props: structuredClone(props) }),
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
          const widths: (number | null)[] = [];
          const map = TableMap.get(body);
          body.forEach((row, rowOffset) => {
            row.forEach((cell, cellOffset) => {
              const col = map.findCell(rowOffset + 1 + cellOffset).left;
              for (let i = 0; i < cell.attrs.colspan; i++) {
                if (cell.attrs.colwidth?.[i])
                  widths[col + i] = cell.attrs.colwidth[i];
              }
            });
            while (widths.length < map.width) widths.push(null);
          });
          const columnWidths = widths.map((width) => width ?? null);
          const authored = body.attrs.columnWidths;
          const widthsChanged =
            columnWidths.some(
              (width, i) => width !== (authored?.[i] ?? null),
            ) ||
            (authored && authored.length !== columnWidths.length);
          data.content = {
            rows,
            type: "tableContent",
            ...Object.fromEntries(
              ["columnWidths", "headerRows", "headerCols"]
                .filter((key) => body.attrs[key] !== null)
                .map((key) => [key, structuredClone(body.attrs[key])]),
            ),
            ...(widthsChanged ? { columnWidths } : {}),
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
