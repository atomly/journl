"use client";
import { Alert, AlertDescription } from "@acme/ui/alert";
import { Button } from "@acme/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";
import { useContext } from "react";
import { useJournlChat } from "~/hooks/use-journl-chat";
import { useChatActions } from "./chat-presentation";
import { ChatSurfaceContext } from "./chat-surface";

export function ChatConversations() {
  const { conversations } = useJournlChat();
  const { status } = useChatActions();
  const container = useContext(ChatSurfaceContext);
  const { branches, threadId, select, loading, error } = conversations;
  const busy = loading || status === "submitted" || status === "streaming";
  return (
    <div className="flex flex-col gap-2 px-4 pt-3">
      <Select
        items={branches.map(({ id, title }) => ({ label: title, value: id }))}
        value={threadId}
        disabled={busy}
        onValueChange={(id) => {
          if (id) void select(id).catch(() => {});
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label="Conversation branch"
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent container={container ?? undefined}>
          <SelectGroup>
            {branches.map(({ id, title }) => (
              <SelectItem key={id} value={id}>
                {title}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void select(threadId).catch(() => {})}
            >
              Reload conversation
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
