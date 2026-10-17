import {
  type DocumentBlock,
  type DocumentBlocks,
  parseBlock,
} from "@acme/document";
import type { EditorPartialBlock } from "./blocknote-schema";

/** The current editor is a consumer of Journl content, never its type authority. */
export function toBlockNoteBlocks(
  blocks: DocumentBlocks,
): [EditorPartialBlock, ...EditorPartialBlock[]] | undefined {
  function convert(block: DocumentBlock): EditorPartialBlock {
    const { children, ...data } = block;
    if (data.type === "codeBlock") {
      const content = Array.isArray(data.content)
        ? data.content
            .map((item) => (typeof item === "string" ? item : item.text))
            .join("")
        : data.content;
      return { ...data, children: children?.map(convert), content };
    }
    return { ...data, children: children?.map(convert) };
  }
  if (!blocks) return undefined;
  const [first, ...rest] = blocks;
  return [convert(first), ...rest.map(convert)];
}
export function fromBlockNoteBlocks(
  blocks: readonly unknown[],
): DocumentBlock[] {
  return blocks.map(parseBlock);
}
