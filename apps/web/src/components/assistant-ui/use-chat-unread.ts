"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useJournlChat } from "~/ai/agents/use-journl-chat";

export function useChatUnread(isChatOpen: boolean) {
  const { chat } = useJournlChat();
  const { messages } = useChat({ chat });
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
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
      setHasUnreadMessages(false);
      return;
    }

    if (lastSeenAssistantMessageId.current === latestAssistantMessageId) {
      return;
    }

    lastSeenAssistantMessageId.current = latestAssistantMessageId;
    setHasUnreadMessages(true);
  }, [isChatOpen, latestAssistantMessageId]);

  return { hasUnreadMessages };
}
