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
  useMessageScroller,
  useMessageScrollerVisibility,
} from "@acme/ui/message-scroller";
import type { UIMessage } from "ai";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { getHumanReadableChatError } from "~/usage/quota-error";
import {
  type ConversationPosition,
  useChatPresentation,
  useConversationPosition,
} from "./chat-presentation";
import { ChatSurfaceContext } from "./chat-surface";
import { ChatComposer } from "./composer";
import { ChatMessage } from "./message";
import { isMessageActivelyStreaming, messageSegments } from "./message-parts";
import { ChatSessionStatus, EarlierChatMessages } from "./session-status";
import "./chat.css";

function unavailableConversation(node: HTMLElement) {
  return (
    !node.isConnected ||
    !node.clientWidth ||
    !node.clientHeight ||
    Boolean(
      node.closest(
        '[inert], [data-slot="drawer-content"][data-state="closed"]',
      ),
    )
  );
}

const pendingMessage: UIMessage = {
  id: "pending",
  parts: [],
  role: "assistant",
};

function ConversationViewport({
  children,
  onRestored,
  restorePosition,
}: {
  children: ReactNode;
  onRestored: (value: boolean) => void;
  restorePosition: ConversationPosition | null;
}) {
  const { position, threadId } = useConversationPosition();
  const { scrollToMessage } = useMessageScroller();
  const visibility = useMessageScrollerVisibility();
  const visible = useRef(visibility);
  visible.current = visibility;
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const restoring = useRef(restorePosition !== null);
  const desired = useRef(restorePosition);
  useEffect(() => {
    if (!node) return;
    let firstFrame = 0;
    let secondFrame = 0;
    const unavailable = () => unavailableConversation(node);
    const restore = () => {
      if (unavailable() || node.hasAttribute("data-pending-scroll")) return;
      const saved = desired.current;
      if (saved?.threadId === threadId) {
        const item = saved.messageId
          ? node.querySelector<HTMLElement>(
              `[data-message-id="${CSS.escape(saved.messageId)}"]`,
            )
          : null;
        if (item && saved.messageId && saved.offset !== undefined) {
          scrollToMessage(saved.messageId, {
            align: "start",
            behavior: "auto",
          });
          node.scrollTop +=
            item.getBoundingClientRect().top -
            node.getBoundingClientRect().top -
            saved.offset;
        } else node.scrollTop = saved.top;
        position.current = { ...saved, top: node.scrollTop };
      }
      restoring.current = false;
      onRestored(true);
    };
    const schedule = () => {
      if (unavailable()) {
        restoring.current = true;
        desired.current =
          position.current?.threadId === threadId
            ? { ...position.current }
            : null;
        return;
      }
      if (!restoring.current) return;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(restore);
      });
    };
    const attributes = new MutationObserver(schedule);
    attributes.observe(node, {
      attributeFilter: ["data-pending-scroll"],
      attributes: true,
    });
    const panel = node.closest('[data-slot="sidebar-container"]');
    if (panel)
      attributes.observe(panel, {
        attributeFilter: ["inert"],
        attributes: true,
      });
    const drawer = node.closest('[data-slot="drawer-content"]');
    if (drawer)
      attributes.observe(drawer, {
        attributeFilter: ["data-state"],
        attributes: true,
      });
    const resize = new ResizeObserver(schedule);
    resize.observe(node);
    schedule();
    return () => {
      attributes.disconnect();
      resize.disconnect();
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [node, onRestored, position, scrollToMessage, threadId]);
  return (
    <MessageScrollerViewport
      ref={setNode}
      aria-label="Conversation"
      className="px-4"
      onScroll={(event) => {
        const viewport = event.currentTarget;
        if (restoring.current || unavailableConversation(viewport)) return;
        const box = viewport.getBoundingClientRect();
        const hit = document
          .elementFromPoint(box.left + box.width / 2, box.top + 1)
          ?.closest<HTMLElement>("[data-message-id]");
        const candidates =
          hit && viewport.contains(hit)
            ? [hit]
            : visible.current.visibleMessageIds
                .map((id) =>
                  viewport.querySelector<HTMLElement>(
                    `[data-message-id="${CSS.escape(id)}"]`,
                  ),
                )
                .filter((item): item is HTMLElement => Boolean(item));
        const anchor = candidates.find(
          (item) => item.getBoundingClientRect().bottom > box.top + 1,
        );
        position.current = {
          messageId: anchor?.dataset.messageId,
          offset: anchor
            ? anchor.getBoundingClientRect().top - box.top
            : undefined,
          threadId,
          top: viewport.scrollTop,
        };
      }}
    >
      {children}
    </MessageScrollerViewport>
  );
}

export function ChatPanel({ welcome }: { welcome: ReactNode }) {
  const { position, threadId } = useConversationPosition();
  const restorePosition = useRef(
    position.current?.threadId === threadId ? { ...position.current } : null,
  ).current;
  const [restored, setRestored] = useState(restorePosition === null);
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
        <MessageScrollerProvider
          autoScroll={restored}
          defaultScrollPosition={restorePosition === null ? "end" : "start"}
        >
          <MessageScroller>
            <ConversationViewport
              restorePosition={restorePosition}
              onRestored={setRestored}
            >
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
            </ConversationViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
        <ChatComposer />
      </section>
    </ChatSurfaceContext.Provider>
  );
}
