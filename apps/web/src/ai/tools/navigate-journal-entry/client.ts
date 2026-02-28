"use client";

import { useRouter } from "next/navigation";
import { createClientTool } from "../../utils/create-client-tool";
import { zNavigateJournalEntryInput } from "./schema";

export function useNavigateJournalEntryTool() {
  const router = useRouter();
  const tool = createClientTool({
    execute: (toolCall, chat) => {
      const entry = `/journal/${toolCall.input.date}`;
      router.push(entry);
      void chat.addToolOutput({
        output: `Navigating to the journal entry: ${entry}`,
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
      });
    },
    inputSchema: zNavigateJournalEntryInput,
    name: "navigateJournalEntry",
  });
  return tool;
}
