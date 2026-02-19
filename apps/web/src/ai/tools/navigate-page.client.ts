"use client";

import { useRouter } from "next/navigation";
import { useDrawer } from "~/components/ui/drawer";
import { createClientTool } from "../utils/create-client-tool";
import { zNavigatePageInput } from "./navigate-page.schema";

export function useNavigatePageTool() {
  const router = useRouter();
  const { closeDrawer } = useDrawer();
  const tool = createClientTool({
    execute: (toolCall, chat) => {
      const page = `/pages/${toolCall.input.id}`;
      router.push(page);
      void chat.addToolOutput({
        output: `Navigating to the page: ${page}`,
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
      });
      closeDrawer();
    },
    inputSchema: zNavigatePageInput,
    name: "navigatePage",
  });
  return tool;
}
