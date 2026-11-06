"use client";

import { useRouter } from "next/navigation";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import { zNavigatePageInput } from "./schema";

export function useNavigatePageTool() {
  const router = useRouter();
  const { whenEditorReady } = useJournlAgent();
  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      const page = `/pages/${toolCall.input.id}`;
      router.push(page);
      try {
        await whenEditorReady(`page:${toolCall.input.id}`);
      } catch {
        void chat.addToolOutput({
          output: {
            message: "The target page editor is not ready. Open it and retry.",
            status: "error",
          },
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
        return;
      }
      void chat.addToolOutput({
        output: {
          link: page,
          message: "Navigating to the requested page.",
        },
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
      });
    },
    inputSchema: zNavigatePageInput,
    name: "navigatePage",
  });
  return tool;
}
