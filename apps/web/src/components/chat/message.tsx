"use client";
import { Bubble, BubbleContent } from "@acme/ui/bubble";
import { Button } from "@acme/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@acme/ui/input-group";
import { Message, MessageContent, MessageFooter } from "@acme/ui/message";
import { Tooltip, TooltipContent, TooltipTrigger } from "@acme/ui/tooltip";
import type { UIMessage } from "ai";
import { CheckIcon, CopyIcon, PencilIcon, RefreshCwIcon } from "lucide-react";
import { type ComponentProps, memo, useEffect, useState } from "react";
import { copyTextToClipboard } from "~/lib/clipboard";
import { useChatActions } from "./chat-presentation";
import { ChatMessageParts } from "./message-parts";

function Action({
  label,
  children,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={label} {...props}>
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
export const ChatMessage = memo(function ChatMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { status, sendMessage, regenerate } = useChatActions();
  const busy = status === "submitted" || status === "streaming";
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const user = message.role === "user";
  return (
    <Message align={user ? "end" : "start"} data-chat-role={message.role}>
      <MessageContent>
        {editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || !draft.trim()) return;
              setEditing(false);
              void sendMessage({ messageId: message.id, text: draft }).catch(
                () => {},
              );
            }}
          >
            <InputGroup>
              <InputGroupTextarea
                aria-label="Edit message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <InputGroupAddon align="block-end">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !draft.trim()}>
                  Save and send
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </form>
        ) : user ? (
          <Bubble align="end" variant="muted">
            <BubbleContent className="whitespace-pre-wrap">
              {text}
            </BubbleContent>
          </Bubble>
        ) : (
          <ChatMessageParts parts={message.parts} />
        )}
        {!editing && (
          <MessageFooter>
            {user ? (
              <Action
                label="Edit message"
                disabled={busy}
                onClick={() => {
                  setDraft(text);
                  setEditing(true);
                }}
              >
                <PencilIcon />
              </Action>
            ) : (
              <>
                <Action
                  label={copied ? "Copied" : "Copy response"}
                  disabled={!text}
                  onClick={() => {
                    void copyTextToClipboard(text)
                      .then(() => {
                        setCopied(true);
                        setCopyError(false);
                      })
                      .catch(() => setCopyError(true));
                  }}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </Action>
                <Action
                  label="Retry response"
                  disabled={busy}
                  onClick={() =>
                    void regenerate({ messageId: message.id }).catch(() => {})
                  }
                >
                  <RefreshCwIcon />
                </Action>
              </>
            )}
            <span className="sr-only" role="status">
              {copied
                ? "Copied"
                : copyError
                  ? "Could not copy. Please retry."
                  : ""}
            </span>
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
});
