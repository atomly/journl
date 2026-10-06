"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
};

/** Base UI equivalent of Radix Slot for wrappers that retain an asChild API. */
export function Slot({ children, ...props }: SlotProps) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { "data-slot": "slot" } as React.ComponentProps<"span">,
      props as React.ComponentProps<"span">,
    ),
    render: React.isValidElement(children) ? children : undefined,
  });
}
