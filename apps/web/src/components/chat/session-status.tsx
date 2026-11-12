"use client";
import { Alert, AlertDescription } from "@acme/ui/alert";
import { Button } from "@acme/ui/button";
import { useJournlChat } from "~/hooks/use-journl-chat";
import { useChatActions } from "./chat-presentation";

export function ChatSessionStatus() {
  const { conversations } = useJournlChat();
  const { status } = useChatActions();
  if (!conversations.error) return null;
  const busy =
    conversations.loading || status === "submitted" || status === "streaming";
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {conversations.error}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (conversations.ready) conversations.dismissError();
            else void conversations.retryStart().catch(() => {});
          }}
        >
          {conversations.ready ? "Dismiss" : "Retry"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function EarlierChatMessages() {
  const { conversations } = useJournlChat();
  const { status } = useChatActions();
  if (!conversations.hasEarlier) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={
        conversations.loading ||
        status === "submitted" ||
        status === "streaming"
      }
      onClick={() => void conversations.loadEarlier().catch(() => {})}
    >
      Load earlier messages
    </Button>
  );
}
