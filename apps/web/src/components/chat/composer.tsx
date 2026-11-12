"use client";
import { Alert, AlertDescription, AlertTitle } from "@acme/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@acme/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@acme/ui/input-group";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { useId } from "react";
import { useChatActions, useComposerDraft } from "./chat-presentation";
import {
  ComposerReasoning,
  ComposerReasoningContent,
  ComposerReasoningTrigger,
} from "./composer-context";
import { ComposerSources } from "./composer-selection";

export function ChatQuotaNotice() {
  const { exceeded } = useChatActions();
  if (!exceeded) return null;
  const date = exceeded.usage.periodEnd
    ? new Date(exceeded.usage.periodEnd)
    : undefined;
  const reset =
    date && Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date)
      : undefined;
  return (
    <Alert>
      <AlertTitle>AI usage limit reached</AlertTitle>
      <AlertDescription>
        You’ve used your plan’s AI allowance.{" "}
        {reset
          ? `Usage resets on ${reset}.`
          : "Wait for your next usage period or review your plan."}
      </AlertDescription>
    </Alert>
  );
}
export function ChatComposer() {
  const { draft, setDraft } = useComposerDraft();
  const { status, sendMessage, stop, exceeded, unavailable } = useChatActions();
  const id = useId();
  const busy = status === "submitted" || status === "streaming";
  const submit = () => {
    if (unavailable || busy || exceeded || !draft.trim()) return;
    const text = draft;
    setDraft("");
    void sendMessage({ text }).catch(() => {});
  };
  return (
    <form
      aria-label="Chat composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2 p-3"
    >
      <ChatQuotaNotice />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={id} className="sr-only">
            Message
          </FieldLabel>
          <InputGroup>
            <InputGroupAddon align="block-start">
              <ComposerSources />
            </InputGroupAddon>
            <InputGroupTextarea
              id={id}
              placeholder={
                exceeded
                  ? "You've reached your AI limit. Upgrade to continue."
                  : "Ask anything..."
              }
              aria-label="Message"
              value={draft}
              disabled={unavailable || Boolean(exceeded)}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key !== "Enter" ||
                  event.shiftKey ||
                  event.nativeEvent.isComposing ||
                  event.nativeEvent.keyCode === 229
                )
                  return;
                event.preventDefault();
                submit();
              }}
              className="max-h-40 min-h-20"
            />
            <InputGroupAddon align="block-end">
              <ComposerReasoning>
                <ComposerReasoningTrigger />
                <ComposerReasoningContent />
              </ComposerReasoning>
              {busy ? (
                <InputGroupButton
                  className="ml-auto"
                  type="button"
                  aria-label="Cancel"
                  onClick={() => void stop()}
                >
                  <SquareIcon />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  className="ml-auto"
                  type="submit"
                  aria-label="Send message"
                  disabled={unavailable || Boolean(exceeded) || !draft.trim()}
                >
                  <ArrowUpIcon />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </FieldGroup>
    </form>
  );
}
