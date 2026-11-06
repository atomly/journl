"use client";

import { useRouter } from "next/navigation";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import { zNavigateJournalEntryInput } from "./schema";

export function useNavigateJournalEntryTool() {
  const router = useRouter();
  const { whenEditorReady } = useJournlAgent();
  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      const entry = `/journal/${toolCall.input.date}`;
      router.push(entry);
      try {
        await whenEditorReady(`journal-entry:${toolCall.input.date}`);
      } catch {
        void chat.addToolOutput({
          output: {
            message:
              "The target journal entry editor is not ready. Open it and retry.",
            status: "error",
          },
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
        return;
      }
      void chat.addToolOutput({
        output: {
          link: entry,
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
