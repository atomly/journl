import z from "zod";
import { zJournlAgentReasoning } from "./journl-agent-reasoning";

const EDITOR_ID_REGEXP = /^(?:journal-entry:\d{4}-\d{2}-\d{2}|page:.+)$/;

type JournalEntryEditor = `journal-entry:${string}`;

type PageEditor = `page:${string}`;

export const zJournlEditorId = z
  .custom<JournalEntryEditor | PageEditor>((value) => {
    if (typeof value !== "string") {
      return false;
    }
    return EDITOR_ID_REGEXP.test(value);
  }, "Expected `journal-entry:{YYYY-MM-DD}` or `page:{ID}`.")
  .describe(
    "The target editor to manipulate. Format: `journal-entry:{YYYY-MM-DD}` or `page:{ID}`.",
  );

export const zJournlAgentContext = z.object({
  activeEditors: z.array(zJournlEditorId),
  currentDate: z.string(),
  highlightedText: z.array(z.string()),
  reasoning: zJournlAgentReasoning,
  user: z.object({
    name: z.string(),
  }),
  view: z.union([
    z.object({
      name: z.literal("journal"),
    }),
    z.object({
      date: z.string(),
      name: z.literal("journal-entry"),
    }),
    z.object({
      id: z.string(),
      name: z.literal("page"),
      title: z.string(),
    }),
    z.object({
      name: z.literal("other"),
    }),
  ]),
});

/**
 * The context of the Journl agent.
 */
export type JournlAgentContext = z.infer<typeof zJournlAgentContext>;
