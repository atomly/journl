import { ServerBlockNoteEditor } from "@blocknote/server-util";
import { createTool } from "@mastra/core/tools";
import { MDocument } from "@mastra/rag";
import { z } from "zod";
import { schema } from "~/components/editor/block-schema";
import { api } from "~/trpc/server";

export const temporalJournalSearch = createTool({
  description: "Search the journal for entries between two dates",
  execute: async ({ context }) => {
    const results = await api.journal.getBetween({
      from: context.from,
      to: context.to,
    });

    return await Promise.all(
      results.map(async (result) => {
        const editor = ServerBlockNoteEditor.create({
          schema,
        });
        const markdown = result.document
          ? await editor.blocksToMarkdownLossy(result.document)
          : "";
        const mDocument = MDocument.fromMarkdown(markdown);
        return {
          content: mDocument.getText().join("\n"),
          date: result.date,
          id: result.id,
          link: `/journal/${result.date}`,
        };
      }),
    );
  },
  id: "temporal-journal-search",
  inputSchema: z.object({
    from: z
      .string()
      .describe(
        "The start date of the search in ISO 8601 format (YYYY-MM-DD for dates and YYYY-MM-DDThh:mm:ssTZD)",
      ),
    to: z
      .string()
      .describe(
        "The end date of the search in ISO 8601 format (YYYY-MM-DD for dates and YYYY-MM-DDThh:mm:ssTZD)",
      ),
  }),
  outputSchema: z.array(
    z.object({
      content: z.string(),
      date: z.string(),
      id: z.string(),
      link: z.string(),
    }),
  ),
});
