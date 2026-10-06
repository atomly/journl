"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import * as React from "react";

import { cn } from "~/lib/cn";

function TooltipProvider({
  delay = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({
  asChild = false,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger> & {
  asChild?: boolean;
}) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      render={
        asChild
          ? (React.Children.only(children) as React.ReactElement)
          : undefined
      }
      {...props}
    >
      {asChild ? undefined : children}
    </TooltipPrimitive.Trigger>
  );
}

function TooltipContent({
  className,
  align,
  alignOffset,
  side,
  sideOffset = 0,
  children,
  ...props
}: Omit<React.ComponentProps<typeof TooltipPrimitive.Popup>, "children"> & {
  children?: React.ReactNode;
} & Pick<
    React.ComponentProps<typeof TooltipPrimitive.Positioner>,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "fade-in-0 zoom-in-95 data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--transform-origin) animate-in text-balance rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs data-[closed]:animate-out",
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-primary fill-primary" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
