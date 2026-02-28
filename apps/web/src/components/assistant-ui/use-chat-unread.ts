"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { useJournlChat } from "~/ai/agents/use-journl-chat";

export function useChatUnread(isChatOpen: boolean) {
  const { chat } = useJournlChat();
  const { messages } = useChat({ chat });
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const previousIsChatOpen = useRef(isChatOpen);
  const closedMessageCountSnapshot = useRef(messages.length);
  const messageCount = messages.length;

  useEffect(() => {
    if (isChatOpen) {
      closedMessageCountSnapshot.current = messageCount;
      setHasUnreadMessages(false);
      previousIsChatOpen.current = isChatOpen;
      return;
    }

    if (previousIsChatOpen.current) {
      closedMessageCountSnapshot.current = messageCount;
      previousIsChatOpen.current = isChatOpen;
      return;
    }

    if (messageCount < closedMessageCountSnapshot.current) {
      closedMessageCountSnapshot.current = messageCount;
      setHasUnreadMessages(false);
      previousIsChatOpen.current = isChatOpen;
      return;
    }

    if (messageCount > closedMessageCountSnapshot.current) {
      setHasUnreadMessages(true);
    }

    previousIsChatOpen.current = isChatOpen;
  }, [isChatOpen, messageCount]);

  return { hasUnreadMessages };
}
