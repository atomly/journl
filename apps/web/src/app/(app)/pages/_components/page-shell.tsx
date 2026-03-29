"use client";

import type { Page } from "@acme/db/schema";
import { useEffect } from "react";
import { useAppEventEmitter } from "~/components/events/app-event-context";
import { PageCreatedEvent } from "~/events/page-created-event";
import { cn } from "~/lib/cn";

type PageShellProps = React.ComponentProps<"div"> & {
  page: Pick<Page, "id">;
};

export async function PageShell({
  className,
  children,
  page,
  ...props
}: PageShellProps) {
  const eventEmitter = useAppEventEmitter();

  // Listen for page created events and drain them if they match the current page ID.
  useEffect(() => {
    const _events = eventEmitter.drain(PageCreatedEvent.eventType, page.id);
  }, [eventEmitter, page.id]);

  return (
    <div
      className={cn(
        "mx-auto flex min-h-full max-w-5xl flex-col gap-4 pt-8 pb-52",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
