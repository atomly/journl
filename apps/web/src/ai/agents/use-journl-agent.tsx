"use client";

import { type UseChatHelpers, useChat } from "@ai-sdk/react";
import {
  type ChatInit,
  DefaultChatTransport,
  type HttpChatTransportInitOptions,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { env } from "~/env";
import { useManipulateEditorTool } from "../tools/manipulate-editor.client";
import { useNavigateJournalEntryTool } from "../tools/navigate-journal-entry.client";
import { useNavigatePageTool } from "../tools/navigate-page.client";
import type { ClientTool } from "../utils/create-client-tool";
import type { JournlAgentContext } from "./journl-agent-context";
import { useJournlAgentAwareness } from "./use-journl-agent-awareness";

type UseJournlAgentOptions<Message extends UIMessage = UIMessage> = {} & Pick<
  ChatInit<Message>,
  "messages"
> & {
    transport: Pick<HttpChatTransportInitOptions<Message>, "api">;
  };

export function useJournlAgent({ transport, messages }: UseJournlAgentOptions) {
  const { getEditors, getView, getSelections } = useJournlAgentAwareness();
  const navigateJournalEntry = useNavigateJournalEntryTool();
  const navigatePage = useNavigatePageTool();
  const manipulateEditor = useManipulateEditorTool();

  const tools = new Map<string, ClientTool<string, UseChatHelpers<UIMessage>>>([
    [navigateJournalEntry.name, navigateJournalEntry],
    [navigatePage.name, navigatePage],
    [manipulateEditor.name, manipulateEditor],
  ]);

  const chat = useChat({
    messages,
    onToolCall: async ({ toolCall }) => {
      if (env.NODE_ENV === "development") {
        console.debug("toolCall 👀", toolCall);
      }
      // Check if it's a dynamic tool first for proper type narrowing
      if (toolCall.dynamic) {
        return;
      }
      const tool = tools.get(toolCall.toolName);
      if (!tool) {
        return;
      }
      await tool.execute(toolCall, chat);
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new DefaultChatTransport({
      ...transport,
      prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => {
        const activeEditors = Array.from(getEditors().keys());
        const selections = getSelections();
        const view = getView();
        return {
          body: {
            context: {
              activeEditors,
              currentDate: new Date().toLocaleString(),
              highlightedText: selections.map((selection) => selection.text),
              view,
            } satisfies JournlAgentContext,
            messageId,
            messages,
            trigger,
          },
          headers: {
            "X-Session-ID": id,
          },
        };
      },
    }),
  });

  return chat;
}
