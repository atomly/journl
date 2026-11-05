"use client";

import { cn } from "@acme/ui/utils";
import { ThreadPrimitive } from "@assistant-ui/react";
import type { ComponentProps } from "react";

type ThreadViewportProps = ComponentProps<typeof ThreadPrimitive.Viewport>;

export function ThreadViewport({ className, ...props }: ThreadViewportProps) {
  return (
    <ThreadPrimitive.Viewport
      className={cn(
        "flex h-full flex-col items-center overflow-y-scroll scroll-smooth bg-inherit px-4",
        className,
      )}
      {...props}
    />
  );
}
