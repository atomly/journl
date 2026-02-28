"use client";

import { cn } from "~/lib/cn";

type ChatUnreadBadgeProps = {
  hasUnreadMessages: boolean;
  className?: string;
};

export function ChatUnreadBadge({
  hasUnreadMessages,
  className,
}: ChatUnreadBadgeProps) {
  if (!hasUnreadMessages) {
    return null;
  }

  return (
    <span
      aria-hidden
      className={cn(
        "absolute -top-1 -right-1 inline-flex size-3 rounded-full border-2 border-background bg-primary",
        className,
      )}
    />
  );
}

export function ChatUnreadA11yHint({
  hasUnreadMessages,
}: {
  hasUnreadMessages: boolean;
}) {
  if (!hasUnreadMessages) {
    return null;
  }

  return <span className="sr-only">New assistant message</span>;
}
