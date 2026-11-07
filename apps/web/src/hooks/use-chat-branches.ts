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

/** Mastra owns saved history. AI SDK owns the active branch's streaming state. */
export function useChatBranches(
  chat: Chat<UIMessage>,
  owner: string,
  thread: RefObject<string>,
) {
  const client = useTRPCClient();
  const root = getChatRootThreadId(owner);
  const [threadId, setThreadId] = useState(root);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const nextPage = useRef(1);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(true);
  const mounted = useRef(false);
  const initialCreation = useRef<ReturnType<
    typeof client.chat.create.mutate
  > | null>(null);

  const activate = useCallback(
    (id: string, messages: UIMessage[], hasMore = false) => {
      thread.current = id;
      chat.messages = messages;
      chat.clearError();
      setThreadId(id);
      setHasEarlier(hasMore);
      nextPage.current = 1;
      setReady(true);
    },
    [chat, thread],
  );

  useEffect(() => {
    mounted.current = true;
    let current = true;
    pending.current = true;
    const createInitialChat = () => {
      if (!initialCreation.current)
        initialCreation.current = client.chat.create.mutate();
      return initialCreation.current;
    };
    // Each application load gets a new thread. Saved transcripts are not
    // resumed automatically; resource-scoped working memory remains shared.
    void createInitialChat()
      .then((history) => {
        if (!current) return;
        activate(history.threadId, history.messages, history.hasMore);
      })
      .catch(() => {
        if (current) setError("Could not start a new chat. Please retry.");
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
  }, [activate, client]);

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

  const retryStart = useCallback(
    () =>
      run(async () => {
        if (ready) return;
        const history = await client.chat.create.mutate();
        if (mounted.current) activate(history.threadId, history.messages);
      }),
    [activate, client, ready, run],
  );

  const loadEarlier = useCallback(
    () =>
      run(async () => {
        if (!hasEarlier) return;
        const history = await client.chat.history.query({
          page: nextPage.current,
          threadId: thread.current,
        });
        if (!mounted.current) return;
        const ids = new Set(chat.messages.map((message) => message.id));
        chat.messages = [
          ...history.messages.filter((message) => !ids.has(message.id)),
          ...chat.messages,
        ];
        nextPage.current += 1;
        setHasEarlier(history.hasMore);
      }),
    [chat, client, hasEarlier, run, thread],
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
        activate(branch.threadId, branch.messages, branch.hasMore);
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
    dismissError: () => setError(null),
    editMessage,
    error,
    hasEarlier,
    loadEarlier,
    loading,
    ready,
    retryResponse,
    retryStart,
    threadId,
  };
}
