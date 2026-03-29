"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAppEventEmitter } from "~/components/events/app-event-context";
import { PageCreatedEvent } from "~/events/page-created-event";
import { insertItem } from "~/trpc/cache/tree-cache";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";
import { createClientTool } from "../../utils/create-client-tool";
import { zCreatePageInput } from "./schema";

export function useCreatePageTool() {
  const router = useRouter();
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
          onSuccess: (newPage) => {
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
                tool: {
                  chat,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                },
              }),
            );

            router.push(`/pages/${newPage.page.id}`);
            void chat.addToolOutput({
              output: {
                message: `Opening new page: ${toolCall.input.title}`,
                page: newPage.page,
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
