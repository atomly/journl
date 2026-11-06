"use client";
import { type UseChatHelpers, useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { createContext, useContext, useMemo, useState } from "react";
import { useJournlChat } from "~/hooks/use-journl-chat";
import {
  parseUsageQuotaExceededPayload,
  type UsageQuotaExceededPayload,
} from "~/usage/quota-error";

type State = Pick<
  UseChatHelpers<UIMessage>,
  "messages" | "status" | "error" | "clearError" | "regenerate"
>;
type Actions = Pick<
  UseChatHelpers<UIMessage>,
  "sendMessage" | "regenerate" | "stop" | "status"
> & { exceeded: UsageQuotaExceededPayload | null };
type Draft = { draft: string; setDraft: (value: string) => void };
const StateContext = createContext<State | null>(null);
const ActionsContext = createContext<Actions | null>(null);
const DraftContext = createContext<Draft | null>(null);

/** Separate streamed messages, shared draft, and actions so typing does not invalidate message rows. */
export function ChatPresentationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { chat } = useJournlChat();
  const { messages, status, error, clearError, sendMessage, regenerate, stop } =
    useChat({ chat });
  const [draft, setDraft] = useState("");
  const state = useMemo(
    () => ({ clearError, error, messages, regenerate, status }),
    [messages, status, error, clearError, regenerate],
  );
  const exceeded = useMemo(
    () => parseUsageQuotaExceededPayload(error),
    [error],
  );
  const actions = useMemo(
    () => ({ exceeded, regenerate, sendMessage, status, stop }),
    [sendMessage, regenerate, stop, status, exceeded],
  );
  const input = useMemo(() => ({ draft, setDraft }), [draft]);
  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>
        <DraftContext.Provider value={input}>{children}</DraftContext.Provider>
      </ActionsContext.Provider>
    </StateContext.Provider>
  );
}
export function useChatPresentation() {
  const value = useContext(StateContext);
  if (!value) throw new Error("ChatPresentationProvider not found");
  return value;
}
export function useChatActions() {
  const value = useContext(ActionsContext);
  if (!value) throw new Error("ChatPresentationProvider not found");
  return value;
}
export function useComposerDraft() {
  const value = useContext(DraftContext);
  if (!value) throw new Error("ChatPresentationProvider not found");
  return value;
}
