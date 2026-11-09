"use client";
import { Alert, AlertDescription, AlertTitle } from "@acme/ui/alert";
import { Button } from "@acme/ui/button";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@acme/ui/message-scroller";
import type { UIMessage } from "ai";
import { type ReactNode, useState } from "react";
import { getHumanReadableChatError } from "~/usage/quota-error";
import { useChatPresentation } from "./chat-presentation";
import { ChatSurfaceContext } from "./chat-surface";
import { ChatComposer } from "./composer";
import { ChatMessage } from "./message";
import { isMessageActivelyStreaming, messageSegments } from "./message-parts";
import { ChatSessionStatus, EarlierChatMessages } from "./session-status";
import "./chat.css";

const pendingMessage: UIMessage = {
  id: "pending",
  parts: [],
  role: "assistant",
};

export function ChatPanel({ welcome }: { welcome: ReactNode }) {
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  const { messages, status, error, clearError, regenerate } =
    useChatPresentation();
  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const waiting = busy && !isMessageActivelyStreaming(lastMessage);
  return (
    <ChatSurfaceContext.Provider value={surface}>
      <section
        ref={setSurface}
        aria-label="Chat"
        className="flex h-full min-h-0 min-w-0 flex-col"
      >
        <ChatSessionStatus />
        <MessageScrollerProvider autoScroll>
          <MessageScroller>
            <MessageScrollerViewport aria-label="Conversation" className="px-4">
              <MessageScrollerContent className="py-4">
                <EarlierChatMessages />
                {!messages.length && (
                  <MessageScrollerItem messageId="welcome">
                    {welcome}
                  </MessageScrollerItem>
                )}
                {messages.map((message, index) =>
                  message.role === "assistant" &&
                  !messageSegments(message.parts).length &&
                  !(busy && index === messages.length - 1) ? null : (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={message.role === "user"}
                    >
                      <ChatMessage
                        message={message}
                        active={busy && index === messages.length - 1}
                        thinking={
                          waiting &&
                          message.role === "assistant" &&
                          index === messages.length - 1
                        }
                      />
                    </MessageScrollerItem>
                  ),
                )}
                {waiting && lastMessage?.role !== "assistant" && (
                  <MessageScrollerItem messageId="pending">
                    <ChatMessage message={pendingMessage} thinking active />
                  </MessageScrollerItem>
                )}
                {error && (
                  <MessageScrollerItem messageId="chat-error">
                    <Alert variant="destructive">
                      <AlertTitle>Could not complete the response</AlertTitle>
                      <AlertDescription>
                        {getHumanReadableChatError(error)}
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            clearError();
                            void regenerate().catch(() => {});
                          }}
                        >
                          Retry response
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </MessageScrollerItem>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
        <ChatComposer />
      </section>
    </ChatSurfaceContext.Provider>
  );
}
