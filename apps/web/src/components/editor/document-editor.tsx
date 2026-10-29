"use client";
import { cn } from "cn";
import { type ComponentProps, useMemo } from "react";
import { toast } from "sonner";
import type { DocumentEditorServices } from "./document-editor-services";
import { DocumentEditor } from "./document-editor-view";
import "./document-editor.css";
import { useIsMobile } from "@acme/ui/use-mobile";
import { useReferenceClient } from "~/components/references/use-reference-client";

export function ConnectedDocumentEditor(
  props: Omit<ComponentProps<typeof DocumentEditor>, "references">,
) {
  const references = useReferenceClient();
  const mobile = useIsMobile();
  const services = useMemo<DocumentEditorServices>(
    () => ({
      getBlockUrl: (id) => {
        const url = new URL(window.location.href);
        url.hash = new URLSearchParams({ block: id }).toString();
        return url.href;
      },
      normalizeReferenceUrl: (url) => new URL(url, window.location.origin).href,
      onActionError: () =>
        toast.error("Could not copy the block link. Please try again."),
      openLink: (href) => {
        window.open(href, "_blank", "noopener,noreferrer");
      },
      ...props.services,
    }),
    [props.services],
  );
  return (
    <DocumentEditor
      {...props}
      className={cn("journl-document-editor", props.className)}
      references={references ?? undefined}
      services={services}
      toolbarMode={props.toolbarMode ?? (mobile ? "sticky" : "floating")}
      toolbarVisibility={
        props.toolbarVisibility ?? (mobile ? "always" : "selection")
      }
      onReady={(editor) => {
        const targetId = new URLSearchParams(window.location.hash.slice(1)).get(
          "block",
        );
        if (targetId) {
          const target = Array.from(
            editor.view.dom.querySelectorAll<HTMLElement>("[data-block-id]"),
          ).find((item) => item.dataset.blockId === targetId);
          target?.scrollIntoView({ block: "center" });
          target?.classList.add("reference-target-highlight");
        }
        props.onReady?.(editor);
      }}
    />
  );
}
