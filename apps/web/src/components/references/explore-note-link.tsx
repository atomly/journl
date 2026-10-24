"use client";

import { Button } from "@acme/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@acme/ui/tooltip";
import { Compass } from "lucide-react";
import Link from "next/link";

export function ExploreNoteLink({ documentId }: { documentId: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="pointer-coarse:size-11 size-10 text-muted-foreground"
            render={<Link href={`/explore?documentId=${documentId}`} />}
            aria-label="Explore this note"
          >
            <Compass aria-hidden="true" />
          </Button>
        }
      />
      <TooltipContent>Explore this note</TooltipContent>
    </Tooltip>
  );
}
