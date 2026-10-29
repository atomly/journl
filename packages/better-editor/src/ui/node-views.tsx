"use client";

import {
  type DocumentBlock,
  parseBlock,
  type ReferenceProps,
  zReferenceProps,
} from "@acme/document";
import { describeExternal } from "@acme/references";
import {
  PreviewIcon,
  PreviewImage,
  PreviewStatus,
  useReferenceEmbed,
  useReferencePreview,
} from "@acme/references/react";
import { Popover, PopoverContent, PopoverTrigger } from "@acme/ui/popover";
import { Button as SurfaceButton } from "@base-ui/react/button";
import { type Editor, Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import type { NodeView } from "@tiptap/pm/view";
import { ChevronRight, ExternalLink } from "lucide-react";
import { createContext, memo, useContext, useMemo, useState } from "react";
import { safeEditorUrl } from "../engine/schema";
import { ReferenceClientContext } from "./reference-client";
import type { ReferenceViewsOptions } from "./reference-views";

export type ReferenceView = {
  key: number;
  dom: HTMLElement;
  node: PMNode;
  getPos: () => number | undefined;
  editor: Editor;
};
/** Portals keep the app's query/router/theme context. Views never write content
 * while resolving previews; clipboard/storage still use the adapter's schema. */
export function referenceViewStore() {
  let views: ReferenceView[] = [];
  let key = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const extension = Extension.create({
    addProseMirrorPlugins() {
      const editor = this.editor;
      const nodeViews = Object.fromEntries(
        ["contentReference", "referenceCard", "contentEmbed"].map((type) => [
          type,
          (
            node: PMNode,
            _view: import("@tiptap/pm/view").EditorView,
            getPos: () => number | undefined,
          ): NodeView => {
            const dom = document.createElement(
              type === "contentReference" ? "span" : "div",
            );
            dom.contentEditable = "false";
            if (type === "contentReference")
              dom.dataset.betterEditorReference = "";
            else dom.dataset.betterEditorBody = type;
            const id = key++;
            let current = node;
            const sync = (next: PMNode) => {
              current = next;
              dom.setAttribute(
                "data-better-editor-attrs",
                JSON.stringify(next.attrs),
              );
              views = [
                ...views.filter((item) => item.key !== id),
                { dom, editor, getPos, key: id, node: next },
              ];
              notify();
            };
            sync(node);
            return {
              deselectNode: () =>
                dom.classList.remove("ProseMirror-selectednode"),
              destroy() {
                views = views.filter((item) => item.key !== id);
                notify();
              },
              dom,
              ignoreMutation: () => true,
              selectNode: () => dom.classList.add("ProseMirror-selectednode"),
              stopEvent: (event) =>
                event.target instanceof Element &&
                Boolean(event.target.closest('a,button,input,[role="menu"]')),
              update(next) {
                if (next.type !== node.type) return false;
                if (next !== current) sync(next);
                return true;
              },
            };
          },
        ]),
      );
      return [new Plugin({ props: { nodeViews } })];
    },
    name: "better-editor-presentation",
  });
  return {
    extension,
    getSnapshot: () => views,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
const EmbedPath = createContext<string[]>([]);
type Target =
  | { kind: "document"; documentId: string; blockId?: string }
  | { kind: "external"; url: string };
function targetOf(props: ReferenceProps): Target | null {
  if (props.targetKind === "document" && props.documentId)
    return {
      documentId: props.documentId,
      kind: "document",
      ...(props.blockId ? { blockId: props.blockId } : {}),
    };
  return props.targetKind === "external" && safeEditorUrl(props.url)
    ? { kind: "external", url: props.url }
    : null;
}
function embedTree(value: unknown): DocumentBlock[] | null {
  if (!Array.isArray(value)) return null;
  try {
    const roots: DocumentBlock[] = [];
    const parents: DocumentBlock[] = [];
    for (const row of value) {
      const { id, type, props, content, depth = 0 } = row;
      const block = parseBlock({ content, id, props, type });
      const level = Math.max(0, Math.min(Number(depth) || 0, parents.length));
      const parent = level ? parents[level - 1] : undefined;
      if (parent) {
        parent.children ??= [];
        parent.children.push(block);
      } else roots.push(block);
      parents.length = level;
      parents.push(block);
    }
    return roots;
  } catch {
    return null;
  }
}
export const ReferenceSurface = memo(function ReferenceSurface({
  view,
  ...options
}: { view: ReferenceView } & ReferenceViewsOptions) {
  const parsed = zReferenceProps.safeParse(view.node.attrs.props);
  if (!parsed.success)
    return <span className="content-reference-status">Unavailable target</span>;
  return <ResolvedReference view={view} props={parsed.data} {...options} />;
});

function ResolvedReference({
  view,
  props,
  renderEmbeddedContent,
  renderActions,
  maxEmbedDepth = Number.POSITIVE_INFINITY,
}: { view: ReferenceView; props: ReferenceProps } & ReferenceViewsOptions) {
  const references = useContext(ReferenceClientContext);
  const path = useContext(EmbedPath);
  const target = useMemo(() => targetOf(props), [props]);
  const { preview, loading: isPending } = useReferencePreview(
    references,
    target,
    Boolean(target),
  );
  const inline = view.node.type.name === "contentReference";
  const title =
    (inline ? props.label : undefined) ||
    (inline ? preview?.compactLabel : undefined) ||
    (preview?.status === "ready" ? preview.title : undefined) ||
    props.label ||
    (target?.kind === "external"
      ? describeExternal(target.url)?.sourceLabel || "External link"
      : "Referenced note");
  const targetUnavailable = preview?.unavailableReason === "target-unavailable";
  const href = targetUnavailable
    ? null
    : safeEditorUrl(
        (preview?.status === "ready" ? preview.href : undefined) || props.url,
      );
  const icon =
    preview?.icon ??
    (target?.kind === "external"
      ? describeExternal(target.url)?.icon
      : "document");
  const [expanded, setExpanded] = useState(false);
  const embed = view.node.type.name === "contentEmbed";
  const key = `${props.documentId}#${props.blockId}`;
  const limited = path.length >= maxEmbedDepth || path.includes(key);
  const { content, loading: loadingEmbed } = useReferenceEmbed(
    references,
    target?.kind === "document" ? target : null,
    embed &&
      expanded &&
      !limited &&
      !targetUnavailable &&
      Boolean(renderEmbeddedContent),
  );
  const blocks = content?.status === "ready" ? embedTree(content.blocks) : null;
  const open = (event: React.MouseEvent) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      props.targetKind === "external"
    )
      return;
    if (href && target && references) {
      event.preventDefault();
      references.openTarget(target, href);
    }
  };
  const link = targetUnavailable ? (
    <span>{title}</span>
  ) : (
    <a
      href={href || undefined}
      onClick={open}
      draggable={false}
      target={props.targetKind === "external" ? "_blank" : undefined}
      rel={props.targetKind === "external" ? "noopener noreferrer" : undefined}
    >
      {title}
    </a>
  );
  const menu = view.editor.isEditable
    ? renderActions?.({
        editor: view.editor,
        getPos: view.getPos,
        node: view.node,
        props,
        withinTable: Boolean(view.dom.closest("table")),
      })
    : null;
  if (inline)
    return (
      <Popover>
        <PopoverTrigger
          nativeButton={false}
          render={
            <a
              className="content-reference"
              href={href || undefined}
              draggable={false}
              onClick={(event) => {
                event.preventDefault();
              }}
            />
          }
        >
          <PreviewIcon icon={icon} className="content-reference-icon" />
          <span>{title}</span>
        </PopoverTrigger>
        <PopoverContent
          className="content-reference-preview"
          data-tiptap-controls=""
          data-tiptap-owner={view.editor.instanceId}
        >
          <strong>{title}</strong>
          <PreviewStatus
            className="content-reference-card-excerpt"
            loading={isPending}
            unavailable={preview?.status === "unavailable" || !preview}
            targetUnavailable={targetUnavailable}
          >
            {preview?.excerpt}
          </PreviewStatus>
          <div className="content-reference-preview-footer">
            {!targetUnavailable && (
              <a
                className="content-reference-open"
                href={href || undefined}
                onClick={open}
              >
                Open source
              </a>
            )}
            {menu}
          </div>
        </PopoverContent>
      </Popover>
    );
  if (embed)
    return (
      <section
        className="content-embed"
        data-block-surface={view.editor.isEditable ? "true" : undefined}
      >
        <div className="content-embed-heading">
          <SurfaceButton
            type="button"
            className="content-embed-toggle"
            aria-expanded={expanded && !targetUnavailable}
            disabled={targetUnavailable}
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronRight
              style={{ transform: expanded ? "rotate(90deg)" : undefined }}
            />
            <strong>{title}</strong>
          </SurfaceButton>
          {menu}
          {!targetUnavailable && (
            <a
              className="content-reference-open"
              href={href || undefined}
              onClick={open}
            >
              <ExternalLink className="size-4" />
              <span>Open source</span>
            </a>
          )}
        </div>
        {targetUnavailable && <PreviewStatus targetUnavailable />}
        {expanded && !targetUnavailable && (
          <div className="content-embed-content">
            {limited || !renderEmbeddedContent ? (
              <p className="content-reference-status">
                Open source to view this reference.
              </p>
            ) : blocks && renderEmbeddedContent ? (
              <EmbedPath.Provider value={[...path, key]}>
                {renderEmbeddedContent(blocks)}
              </EmbedPath.Provider>
            ) : (
              <p className="content-reference-status">
                {loadingEmbed
                  ? "Loading…"
                  : "Referenced content is unavailable."}
              </p>
            )}
          </div>
        )}
      </section>
    );
  return (
    <article
      className="content-reference-card"
      data-block-surface={view.editor.isEditable ? "true" : undefined}
      aria-label={`${title} reference card`}
    >
      <PreviewImage
        className="content-reference-thumbnail"
        src={preview?.status === "ready" ? preview.imageUrl : undefined}
      />
      <div className="content-reference-card-body">
        <div className="content-reference-card-heading">
          <PreviewIcon icon={icon} className="content-reference-icon" />
          {link}
          {menu}
        </div>
        <PreviewStatus
          className="content-reference-card-excerpt"
          loading={isPending}
          unavailable={preview?.status === "unavailable" || !preview}
          targetUnavailable={targetUnavailable}
        >
          {preview?.excerpt}
        </PreviewStatus>
        <div className="content-reference-source">
          {preview?.status === "ready"
            ? preview.kind === "journal"
              ? "Journal entry"
              : preview.kind === "page"
                ? "Page"
                : (preview.sourceLabel ??
                  (describeExternal(props.url)?.sourceLabel ||
                    "Referenced note"))
            : ""}
          {preview?.sourceStatus ? ` · ${preview.sourceStatus}` : ""}
        </div>
      </div>
    </article>
  );
}
