import { ServerBlockNoteEditor } from "@blocknote/server-util";
import { type EditorPartialBlock, serverSchema } from "./blocknote-schema";

/**
 * Converts BlockNote blocks to Markdown.
 *
 * @returns The Markdown string.
 */
export async function blocknoteMarkdown(
  blocks: [EditorPartialBlock, ...EditorPartialBlock[]],
) {
  const editor = ServerBlockNoteEditor.create({
    schema: serverSchema,
  });
  const markdown = blocks ? await editor.blocksToMarkdownLossy(blocks) : "";
  return markdown;
}
