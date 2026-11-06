"use client";
import { cn } from "cn";
import { type ComponentProps, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { DocumentEditorServices } from "./document-editor-services";
import { DocumentEditor } from "./document-editor-view";
import "./document-editor.css";
import { useIsMobile } from "@acme/ui/use-mobile";
import type { Editor } from "@tiptap/core";
import type { DocumentEditSession } from "~/ai/client/document-edit-session";
import type { JournlAgentContext } from "~/ai/mastra/agents/journl-agent-context";
import { useReferenceClient } from "~/components/references/use-reference-client";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { DocumentWritingStatus } from "./document-writing-status";

export function ConnectedDocumentEditor(
  props: Omit<ComponentProps<typeof DocumentEditor>, "references"> & {
    agentEditorId?: JournlAgentContext["activeEditors"][number];
  },
) {
  const references = useReferenceClient();
  const { registerEditor } = useJournlAgent();
  const [instance, setInstance] = useState<Editor>();
  const [session, setSession] = useState<DocumentEditSession>();
  useEffect(() => {
    if (!instance || !props.agentEditorId) return;
    const binding = registerEditor(props.agentEditorId, instance);
    setSession(binding.session);
    return binding.dispose;
  }, [instance, props.agentEditorId, registerEditor]);
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
      afterContent={
        session ? <DocumentWritingStatus session={session} /> : undefined
      }
      services={services}
      toolbarMode={props.toolbarMode ?? (mobile ? "sticky" : "floating")}
      toolbarVisibility={
        props.toolbarVisibility ?? (mobile ? "always" : "selection")
      }
      onReady={(editor) => {
        setInstance(editor);
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
