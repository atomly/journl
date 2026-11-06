"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAppEventEmitter } from "~/components/events/app-event-context";
import { PageCreatedEvent } from "~/events/page-created-event";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { insertItem } from "~/trpc/cache/tree-cache";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";
import { createClientTool } from "../../utils/create-client-tool";
import { zCreatePageInput } from "./schema";

export function useCreatePageTool() {
  const router = useRouter();
  const { whenEditorReady } = useJournlAgent();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const eventEmitter = useAppEventEmitter();

  const { mutateAsync: createPage } = useMutation(
    trpc.tree.createPage.mutationOptions({}),
  );

  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      const newPage = await createPage({
        destination: { parent_node_id: null },
        title: toolCall.input.title,
      });
      insertItem({
        item: newPage,
        queryClient,
        queryKey: trpc.tree.getChildrenPaginated.infiniteQueryKey(
          getInfiniteSidebarTreeQueryOptions(null),
        ),
      });
      eventEmitter.buffer(
        new PageCreatedEvent({
          id: newPage.page.id,
          title: toolCall.input.title,
        }),
      );
      const link = `/pages/${newPage.page.id}`;
      router.push(link);
      try {
        await whenEditorReady(`page:${newPage.page.id}`);
      } catch {
        void chat.addToolOutput({
          output: {
            message:
              "Page created, but its editor is not ready. Open the page before asking for edits.",
            status: "error",
          },
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
        return;
      }
      void chat.addToolOutput({
        output: {
          link,
          message: `Opened new page: ${toolCall.input.title}`,
          page: newPage.page,
          targetEditor: `page:${newPage.page.id}`,
        },
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
      });
    },
    inputSchema: zCreatePageInput,
    name: "createPage",
  });
  return tool;
}
