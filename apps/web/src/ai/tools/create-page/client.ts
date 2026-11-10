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
  const { whenEditorReady, prepareEdits } = useJournlAgent();
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
        /* Creation succeeded even if its editor is still loading. */
      }
      // Always replace the previous target, including on a loading timeout or
      // a route change between the readiness notification and this continuation.
      const editorReady = prepareEdits(`page:${newPage.page.id}`);
      void chat.addToolOutput({
        output: {
          editorReady,
          link,
          message: editorReady
            ? `Opened new page: ${toolCall.input.title}`
            : "Page created successfully; its editor is not ready. Do not create another page. Use navigatePage with this page ID to wait for the editor, then write.",
          page: newPage.page,
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
