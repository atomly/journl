"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useJournlChat } from "~/ai/agents/use-journl-chat";

const MAX_UNREAD_ASSISTANT_MESSAGES = 9;

export function useChatNudge(isChatOpen: boolean) {
  const { chat } = useJournlChat();
  const { messages } = useChat({ chat });
  const [unreadAssistantMessages, setUnreadAssistantMessages] = useState(0);
  const hasInitialized = useRef(false);
  const lastSeenAssistantMessageId = useRef<string | undefined>(undefined);

  const latestAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message?.role === "assistant") {
        return message.id;
      }
    }
    return undefined;
  }, [messages]);

  useEffect(() => {
    if (!latestAssistantMessageId) {
      return;
    }

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      lastSeenAssistantMessageId.current = latestAssistantMessageId;
      return;
    }

    if (isChatOpen) {
      lastSeenAssistantMessageId.current = latestAssistantMessageId;
      setUnreadAssistantMessages(0);
      return;
    }

    if (lastSeenAssistantMessageId.current === latestAssistantMessageId) {
      return;
    }

    lastSeenAssistantMessageId.current = latestAssistantMessageId;
    setUnreadAssistantMessages((current) =>
      Math.min(current + 1, MAX_UNREAD_ASSISTANT_MESSAGES),
    );
  }, [isChatOpen, latestAssistantMessageId]);

  return {
    hasUnreadAssistantMessages: unreadAssistantMessages > 0,
    unreadAssistantMessages,
    unreadAssistantMessagesLabel:
      unreadAssistantMessages >= MAX_UNREAD_ASSISTANT_MESSAGES
        ? `${MAX_UNREAD_ASSISTANT_MESSAGES}+`
        : String(unreadAssistantMessages),
  };
}
