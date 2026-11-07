import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getChatRootThreadId } from "~/ai/chat-thread";
import { useTRPCClient } from "~/trpc/react";

type Branch = { id: string; title: string };

/** Mastra owns saved history. AI SDK owns the active branch's streaming state. */
export function useChatBranches(
  chat: Chat<UIMessage>,
  owner: string,
  thread: RefObject<string>,
) {
  const client = useTRPCClient();
  const root = getChatRootThreadId(owner);
  const storageKey = `journl:chat-thread:${owner}`;
  const [branches, setBranches] = useState<Branch[]>([
    { id: root, title: "Original conversation" },
  ]);
  const [threadId, setThreadId] = useState(root);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(true);
  const mounted = useRef(false);

  const activate = useCallback(
    (id: string, messages: UIMessage[]) => {
      thread.current = id;
      chat.messages = messages;
      chat.clearError();
      setThreadId(id);
      setReady(true);
      try {
        sessionStorage.setItem(storageKey, id);
      } catch {
        /* Storage can be disabled. */
      }
    },
    [chat, storageKey, thread],
  );

  useEffect(() => {
    mounted.current = true;
    let current = true;
    let selected = root;
    try {
      selected = sessionStorage.getItem(storageKey) || root;
    } catch {
      /* Storage can be disabled. */
    }
    pending.current = true;
    void Promise.all([
      client.chat.list.query(),
      client.chat.history.query({ threadId: selected }),
    ])
      .then(([items, history]) => {
        if (!current) return;
        setBranches(items);
        activate(history.threadId, history.messages);
      })
      .catch(() => {
        if (current)
          setError(
            "Could not load the conversation. Select a conversation to retry.",
          );
      })
      .finally(() => {
        if (current) {
          pending.current = false;
          setLoading(false);
        }
      });
    return () => {
      current = false;
      mounted.current = false;
    };
  }, [activate, client, root, storageKey]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (
        pending.current ||
        chat.status === "submitted" ||
        chat.status === "streaming"
      )
        return;
      pending.current = true;
      setLoading(true);
      setError(null);
      try {
        await action();
      } catch (error) {
        if (mounted.current)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load the conversation. Please retry.",
          );
        throw error;
      } finally {
        pending.current = false;
        if (mounted.current) setLoading(false);
      }
    },
    [chat],
  );

  const select = useCallback(
    (id: string) =>
      run(async () => {
        const [history, items] = await Promise.all([
          client.chat.history.query({ threadId: id }),
          client.chat.list.query(),
        ]);
        if (!mounted.current) return;
        activate(history.threadId, history.messages);
        setBranches(items);
      }),
    [activate, client, run],
  );

  const fork = useCallback(
    (kind: "edit" | "retry", messageId: string, text?: string) =>
      run(async () => {
        const index = chat.messages.findIndex(
          (message) => message.id === messageId,
        );
        const user = chat.messages[index];
        const pendingPrompt =
          user?.role === "user"
            ? {
                previousMessageId: chat.messages[index - 1]?.id,
                text: user.parts
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join("\n"),
              }
            : undefined;
        const branch = await client.chat.branch.mutate({
          kind,
          messageId,
          pendingPrompt: pendingPrompt?.text ? pendingPrompt : undefined,
          threadId: thread.current,
        });
        if (!mounted.current) return;
        activate(branch.threadId, branch.messages);
        setBranches((items) => [
          ...items,
          { id: branch.threadId, title: branch.title },
        ]);
        if (kind === "edit")
          void chat.sendMessage({ text: text ?? "" }).catch(() => {});
        else void chat.regenerate().catch(() => {});
      }),
    [activate, chat, client, run, thread],
  );

  const editMessage = useCallback(
    (id: string, text: string) => fork("edit", id, text),
    [fork],
  );
  const retryResponse = useCallback(
    ({ messageId }: { messageId?: string } = {}) => {
      let index = messageId
        ? chat.messages.findIndex((message) => message.id === messageId)
        : chat.messages.length - 1;
      // Retry the prompt, including after a partially streamed or unsaved answer.
      while (index >= 0 && chat.messages[index]?.role !== "user") index -= 1;
      const id = chat.messages[index]?.id;
      return id ? fork("retry", id) : Promise.resolve();
    },
    [chat, fork],
  );

  return {
    branches,
    editMessage,
    error,
    loading,
    ready,
    retryResponse,
    select,
    threadId,
  };
}
