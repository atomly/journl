"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import * as React from "react";

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  asChild = false,
  children,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger> & {
  asChild?: boolean;
}) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      render={
        asChild
          ? (React.Children.only(children) as React.ReactElement)
          : undefined
      }
      {...props}
    >
      {asChild ? undefined : children}
    </CollapsiblePrimitive.Trigger>
  );
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Panel>) {
  return (
    <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
