import { ServerBlockNoteEditor } from "@blocknote/server-util";
import { type EditorPartialBlock, schema } from "../blocknote-schema";

/**
 * Converts BlockNote blocks to Markdown.
 *
 * @returns The Markdown string.
 */
export async function blocknoteMarkdown(
  blocks: [EditorPartialBlock, ...EditorPartialBlock[]],
) {
  const editor = ServerBlockNoteEditor.create({
    schema,
  });
  const markdown = blocks ? await editor.blocksToMarkdownLossy(blocks) : "";
  return markdown;
}
