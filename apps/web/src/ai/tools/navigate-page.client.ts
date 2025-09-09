"use client";

import { useRouter } from "next/navigation";
import { createClientTool } from "../utils/create-client-tool";
import { zNavigatePageInput } from "./navigate-page.schema";

export function useNavigatePageTool() {
  const router = useRouter();
  const tool = createClientTool({
    execute: (toolCall, chat) => {
      const page = `/pages/${toolCall.input.id}`;
      router.push(page);
      chat.addToolResult({
        output: `Navigating to the page: ${page}`,
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
      });
    },
    inputSchema: zNavigatePageInput,
    name: "navigatePage",
  });
  return tool;
}
