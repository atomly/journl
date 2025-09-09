import type { PartialBlock } from "@blocknote/core";
import { ServerBlockNoteEditor } from "@blocknote/server-util";
import { schema } from "../blocknote-schema";

/**
 * Converts BlockNote blocks to Markdown.
 *
 * @returns The Markdown string.
 */
export async function blocknoteMarkdown(
  blocks: [PartialBlock, ...PartialBlock[]],
) {
  const editor = ServerBlockNoteEditor.create({
    schema,
  });
  const markdown = blocks ? await editor.blocksToMarkdownLossy(blocks) : "";
  return markdown;
}
