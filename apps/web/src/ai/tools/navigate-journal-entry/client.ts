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
        output: {
          message: "Navigating to the requested journal entry.",
        },
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
      });
    },
    inputSchema: zNavigateJournalEntryInput,
    name: "navigateJournalEntry",
  });
  return tool;
}
