"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { useJournlChat } from "~/hooks/use-journl-chat";

export function useChatUnread(isChatOpen: boolean) {
  const { chat, conversations } = useJournlChat();
  const { messages } = useChat({ chat });
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const initialized = useRef(false);
  const previousIsChatOpen = useRef(isChatOpen);
  const closedMessageCountSnapshot = useRef(messages.length);
  const messageCount = messages.length;

  useEffect(() => {
    // Restored history is already read. Only messages received after hydration
    // can mark a closed chat unread.
    if (!conversations.ready || !initialized.current) {
      initialized.current = conversations.ready;
      closedMessageCountSnapshot.current = messageCount;
      previousIsChatOpen.current = isChatOpen;
      setHasUnreadMessages(false);
      return;
    }
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
  }, [isChatOpen, messageCount, conversations.ready]);

  return { hasUnreadMessages };
}
