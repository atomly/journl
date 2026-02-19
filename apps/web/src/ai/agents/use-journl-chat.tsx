import { Chat } from "@ai-sdk/react";
import {
  type ChatInit,
  DefaultChatTransport,
  type HttpChatTransportInitOptions,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { createContext, useContext, useState } from "react";
import { env } from "~/env";
import { useCreatePageTool } from "../tools/create-page.client";
import { useManipulateEditorTool } from "../tools/manipulate-editor.client";
import { useNavigateJournalEntryTool } from "../tools/navigate-journal-entry.client";
import { useNavigatePageTool } from "../tools/navigate-page.client";
import type { ClientTool } from "../utils/create-client-tool";
import type { JournlAgentState } from "./journl-agent-state";
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
  const { getSelections, getEditors, getView } = useJournlAgent();

  const createPage = useCreatePageTool();
  const navigateJournalEntry = useNavigateJournalEntryTool();
  const navigatePage = useNavigatePageTool();
  const manipulateEditor = useManipulateEditorTool();

  const [chat] = useState(() => {
    const tools = new Map<string, ClientTool<string, Chat<UIMessage>>>([
      [createPage.name, createPage],
      [navigateJournalEntry.name, navigateJournalEntry],
      [navigatePage.name, navigatePage],
      [manipulateEditor.name, manipulateEditor],
    ]);

    return new Chat({
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
          const selections = getSelections();
          const view = getView();
          return {
            body: {
              context: {
                activeEditors: Array.from(getEditors().entries()).map(
                  ([_, { editor, ...rest }]) => rest,
                ),
                currentDate: new Date().toLocaleString(),
                highlightedText: selections.map((selection) => selection.text),
                view,
              } satisfies Omit<JournlAgentState, "user">,
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
