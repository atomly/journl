"use client";

import type { ComponentProps } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/assistant-ui/tooltip";
import { Button } from "~/components/ui/button";
import { cn } from "~/components/utils";

export type TooltipIconButtonProps = ComponentProps<typeof Button> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
};

export function TooltipIconButton({
  children,
  tooltip,
  side = "bottom",
  className,
  ref,
  ...rest
}: TooltipIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          {...rest}
          className={cn("aui-button-icon", className)}
          ref={ref}
        >
          {children}
          <span className="aui-sr-only">{tooltip}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
