"use client";

import { cn } from "@acme/ui/utils";
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  );
}

function CollapsibleContent({
  animateHeight = false,
  className,
  ...props
}: CollapsiblePrimitive.Panel.Props & { animateHeight?: boolean }) {
  const animationClassName = animateHeight
    ? "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none"
    : undefined;
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={
        typeof className === "function"
          ? (state) => cn(animationClassName, className(state))
          : cn(animationClassName, className)
      }
      {...props}
    />
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
