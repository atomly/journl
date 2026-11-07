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
import { Tooltip, TooltipContent, TooltipTrigger } from "@acme/ui/tooltip";
import { SquarePenIcon } from "lucide-react";
import { useContext } from "react";
import { useJournlChat } from "~/hooks/use-journl-chat";
import { useChatActions } from "./chat-presentation";
import { ChatSurfaceContext } from "./chat-surface";

export function ChatConversations() {
  const { conversations } = useJournlChat();
  const { status } = useChatActions();
  const container = useContext(ChatSurfaceContext);
  const { branches, threadId, select, loading, error, newChat } = conversations;
  const busy = loading || status === "submitted" || status === "streaming";
  return (
    <div className="flex flex-col gap-2 px-4 pt-3">
      <div className="flex items-center gap-2">
        <Select
          items={branches.map(({ id, title }) => ({ label: title, value: id }))}
          value={branches.length ? threadId : null}
          disabled={busy}
          onValueChange={(id) => {
            if (id) void select(id).catch(() => {});
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label="Conversation branch"
            className="min-w-0 flex-1"
          >
            <SelectValue placeholder="Starting chat…" />
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
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="New chat"
                disabled={busy}
                onClick={() => void newChat().catch(() => {})}
              >
                <SquarePenIcon />
              </Button>
            }
          />
          <TooltipContent>New chat</TooltipContent>
        </Tooltip>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void (conversations.ready ? select(threadId) : newChat()).catch(
                  () => {},
                )
              }
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
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
