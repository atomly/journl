import { Chat } from "@ai-sdk/react";
import {
  type ChatInit,
  DefaultChatTransport,
  type HttpChatTransportInitOptions,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { createContext, useContext, useState } from "react";
import type { JournlAgentContext } from "~/ai/mastra/agents/journl-agent-context";
import { useCreatePageTool } from "~/ai/tools/create-page/client";
import { useNavigateJournalEntryTool } from "~/ai/tools/navigate-journal-entry/client";
import { useNavigatePageTool } from "~/ai/tools/navigate-page/client";
import { useWriteTool } from "~/ai/tools/write/client";
import {
  type ClientTool,
  InvalidClientToolCall,
} from "~/ai/utils/create-client-tool";
import { env } from "~/env";
import { useJournlAgent } from "./use-journl-agent";

const JournlChatContext = createContext<{
  chat: Chat<UIMessage>;
} | null>(null);

type JournlChatProviderProps<Message extends UIMessage = UIMessage> = {
  children: React.ReactNode;
} & Pick<ChatInit<Message>, "messages"> & {
    transport: Pick<HttpChatTransportInitOptions<Message>, "api">;
  };

export function JournlChatProvider({
  children,
  transport,
  messages,
}: JournlChatProviderProps) {
  const {
    getSelections: getAllSelections,
    getEditors,
    getView,
    getReasoning,
    prepareEdits,
    cancelEdits,
  } = useJournlAgent();

  const createPage = useCreatePageTool();
  const navigateJournalEntry = useNavigateJournalEntryTool();
  const navigatePage = useNavigatePageTool();
  const write = useWriteTool();

  const [chat] = useState(() => {
    const tools = new Map<string, ClientTool<string, Chat<UIMessage>>>([
      [createPage.name, createPage],
      [navigateJournalEntry.name, navigateJournalEntry],
      [navigatePage.name, navigatePage],
      [write.name, write],
    ]);

    const instance = new Chat({
      messages,
      onToolCall: async ({ toolCall }) => {
        if (env.NODE_ENV === "development") {
          console.debug("[onToolCall]", toolCall);
        }
        // Check if it's a dynamic tool first for proper type narrowing
        if (toolCall.dynamic) {
          return;
        }
        const tool = tools.get(toolCall.toolName);
        if (!tool) {
          return;
        }
        try {
          await tool.execute(toolCall, instance);
        } catch (error) {
          // Keep invalid arguments and failed client actions in the native tool
          // lifecycle. Do not await a queued update inside onToolCall.
          void instance.addToolOutput({
            errorText:
              error instanceof InvalidClientToolCall
                ? error.message
                : "This action could not complete. Please retry.",
            state: "output-error",
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
        }
      },
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      transport: new DefaultChatTransport({
        ...transport,
        prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => {
          if (messages.at(-1)?.role === "user") prepareEdits();
          const selections = getAllSelections();
          const view = getView();

          return {
            body: {
              context: {
                activeEditors: Array.from(getEditors().keys()),
                currentDate: new Date().toLocaleString(),
                highlightedText: selections.map((selection) => selection.text),
                reasoning: getReasoning(),
                view,
              } satisfies Omit<JournlAgentContext, "user">,
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
    const stop = instance.stop;
    instance.stop = async () => {
      cancelEdits();
      await stop();
    };
    return instance;
  });

  return (
    <JournlChatContext.Provider
      value={{
        chat,
      }}
    >
      {children}
    </JournlChatContext.Provider>
  );
}

export function useJournlChat() {
  const context = useContext(JournlChatContext);
  if (!context) {
    throw new Error("JournlChatContext not found");
  }
  return context;
}
