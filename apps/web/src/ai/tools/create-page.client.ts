"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { infinitePagesQueryOptions } from "~/app/api/trpc/options/pages-query-options";
import { useTRPC } from "~/trpc/react";
import { useAppEventEmitter } from "../../components/events/app-event-context";
import { PageCreatedEvent } from "../../events/page-created-event";
import { createClientTool } from "../utils/create-client-tool";
import { zCreatePageInput } from "./create-page.schema";

export function useCreatePageTool() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const eventEmitter = useAppEventEmitter();

  const { mutate: createPage } = useMutation(
    trpc.pages.create.mutationOptions({}),
  );

  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      createPage(
        {
          title: toolCall.input.title,
        },
        {
          onError: (error) => {
            console.error("Failed to create page:", error);
            void chat.addToolResult({
              output: `Failed to create page ${toolCall.input.title}`,
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
            });
          },
          onSuccess: (newPage) => {
            // Optimistically update the pages list
            queryClient.setQueryData(
              trpc.pages.getPaginated.infiniteQueryOptions(
                infinitePagesQueryOptions,
              ).queryKey,
              (old) => {
                if (!old)
                  return {
                    pageParams: [],
                    pages: [
                      {
                        items: [newPage],
                        nextCursor: undefined,
                      },
                    ],
                  };
                const [first, ...rest] = old.pages;
                return {
                  ...old,
                  pages: [
                    {
                      ...first,
                      items: [newPage, ...(first?.items ?? [])],
                      nextCursor: first?.nextCursor,
                    },
                    ...rest,
                  ],
                };
              },
            );

            eventEmitter.buffer(
              new PageCreatedEvent({
                chat,
                id: newPage.id,
                title: toolCall.input.title,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
              }),
            );

            router.push(`/pages/${newPage.id}`);
          },
        },
      );
    },
    inputSchema: zCreatePageInput,
    name: "createPage",
  });
  return tool;
}
