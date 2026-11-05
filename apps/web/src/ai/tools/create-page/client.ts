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

  const { mutate: createPage } = useMutation(
    trpc.tree.createPage.mutationOptions({}),
  );

  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      createPage(
        {
          destination: {
            parent_node_id: null,
          },
          title: toolCall.input.title,
        },
        {
          onError: (error) => {
            console.error("Failed to create page:", error);
            void chat.addToolOutput({
              output: {
                error,
                message: `Failed to create page: ${toolCall.input.title}`,
              },
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
            });
          },
          onSuccess: async (newPage) => {
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

            router.push(`/pages/${newPage.page.id}`);
            try {
              await whenEditorReady(`page:${newPage.page.id}`);
            } catch {
              await chat.addToolOutput({
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
                message: `Opened new page: ${toolCall.input.title}`,
                page: newPage.page,
                targetEditor: `page:${newPage.page.id}`,
              },
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
            });
          },
        },
      );
    },
    inputSchema: zCreatePageInput,
    name: "createPage",
  });
  return tool;
}
