"use client";

import {
  type DocumentBlock,
  parseBlock,
  type ReferenceProps,
  zReferenceProps,
} from "@acme/document";
import {
  convertReference,
  referenceDisplayAllowed,
  safeEditorUrl,
} from "@acme/tiptap";
import { useQuery } from "@tanstack/react-query";
import { type Editor, Extension } from "@tiptap/core";
import { dropCursor } from "@tiptap/pm/dropcursor";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin } from "@tiptap/pm/state";
import type { NodeView } from "@tiptap/pm/view";
import {
  ChevronRight,
  ExternalLink,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useTRPC } from "~/trpc/react";
import {
  EditorHint,
  EditorMenuItem,
  restoreEditorFocus,
} from "./tiptap-controls";
import { TiptapEditor } from "./tiptap-editor";
import { referenceDisplays } from "./tiptap-reference-display";

type ReferenceView = {
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
            if (type === "contentReference") dom.dataset.journlReference = "";
            else dom.dataset.journlBody = type;
            const id = key++;
            const sync = (next: PMNode) => {
              dom.setAttribute("data-journl-attrs", JSON.stringify(next.attrs));
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
                sync(next);
                return true;
              },
            };
          },
        ]),
      );
      return [
        new Plugin({ props: { nodeViews } }),
        dropCursor({ color: "var(--ring)", width: 2 }),
      ];
    },
    name: "journlPresentation",
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
export type ReferenceViewStore = ReturnType<typeof referenceViewStore>;
const EMPTY: ReferenceView[] = [];
export function TiptapReferenceViews({ store }: { store: ReferenceViewStore }) {
  const views = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => EMPTY,
  );
  return views.map((view) =>
    createPortal(<ReferenceSurface view={view} />, view.dom, view.key),
  );
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
function ReferenceSurface({ view }: { view: ReferenceView }) {
  const parsed = zReferenceProps.safeParse(view.node.attrs.props);
  if (!parsed.success)
    return <span className="content-reference-status">Unavailable target</span>;
  return <ResolvedReference view={view} props={parsed.data} />;
}
function ResolvedReference({
  view,
  props,
}: {
  view: ReferenceView;
  props: ReferenceProps;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const path = useContext(EmbedPath);
  const target = targetOf(props);
  const { data, isPending } = useQuery({
    ...trpc.references.getPreviews.queryOptions({
      targets: target ? [target] : [],
    }),
    enabled: Boolean(target),
    staleTime: 30000,
  });
  const preview = data?.items[0]?.preview;
  const inline = view.node.type.name === "contentReference";
  const title =
    (inline ? props.label : undefined) ||
    (preview?.status === "ready" ? preview.title : undefined) ||
    props.label ||
    (target?.kind === "external"
      ? new URL(target.url).hostname
      : "Referenced note");
  const href = safeEditorUrl(
    (preview?.status === "ready" ? preview.href : undefined) || props.url,
  );
  const Icon = props.targetKind === "external" ? ExternalLink : FileText;
  const [expanded, setExpanded] = useState(false);
  const embed = view.node.type.name === "contentEmbed";
  const key = `${props.documentId}#${props.blockId}`;
  const limited = path.length >= 2 || path.includes(key);
  const { data: embedData, isPending: loadingEmbed } = useQuery({
    ...trpc.references.getEmbedContent.queryOptions({
      targets: [
        {
          documentId: props.documentId,
          ...(props.blockId ? { blockId: props.blockId } : {}),
        },
      ],
    }),
    enabled: embed && expanded && !limited && Boolean(props.documentId),
    staleTime: 30000,
  });
  const content = embedData?.items[0] as
    | { status?: string; blocks?: unknown }
    | undefined;
  const blocks = content?.status === "ready" ? embedTree(content.blocks) : null;
  const open = (event: React.MouseEvent) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      props.targetKind === "external"
    )
      return;
    event.preventDefault();
    if (href) {
      const url = new URL(href, location.origin);
      router.push(`${url.pathname}${url.search}${url.hash}`);
    }
  };
  const link = (
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
  const change = (display: Parameters<typeof convertReference>[1]) => {
    const pos = view.getPos();
    if (pos === undefined || !view.editor.isEditable) return;
    const state = view.editor.state;
    view.editor.view.dispatch(
      state.tr.setSelection(NodeSelection.create(state.doc, pos)),
    );
    const tr = convertReference(view.editor.state, display, () =>
      crypto.randomUUID(),
    );
    if (tr) view.editor.view.dispatch(tr);
    view.editor.view.focus();
  };
  const menu = view.editor.isEditable && (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <EditorHint label="Change how this link is displayed">
          <button
            type="button"
            className="content-reference-action"
            aria-label="Reference actions"
          >
            <MoreHorizontal />
          </button>
        </EditorHint>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-tiptap-controls=""
        finalFocus={() => {
          return restoreEditorFocus(view.editor);
        }}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Display as</DropdownMenuLabel>
          {referenceDisplays
            .filter(
              ({ type }) =>
                type !== view.node.type.name &&
                referenceDisplayAllowed(
                  type,
                  props.targetKind,
                  Boolean(view.dom.closest("table")),
                ),
            )
            .map(({ type, label, hint }) => (
              <EditorMenuItem
                key={type}
                hint={hint}
                onClick={() => change(type)}
              >
                {label}
              </EditorMenuItem>
            ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
          <Icon className="content-reference-icon" />
          <span>{title}</span>
        </PopoverTrigger>
        <PopoverContent
          className="content-reference-preview"
          data-tiptap-controls=""
        >
          <strong>{title}</strong>
          <p className="content-reference-card-excerpt">
            {preview?.status === "ready"
              ? preview.excerpt
              : isPending
                ? "Loading…"
                : "Referenced content is unavailable."}
          </p>
          <div className="content-reference-preview-footer">
            <a
              className="content-reference-open"
              href={href || undefined}
              onClick={open}
            >
              Open source
            </a>
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
          <button
            type="button"
            className="content-embed-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronRight
              style={{ transform: expanded ? "rotate(90deg)" : undefined }}
            />
            <strong>{title}</strong>
          </button>
          {menu}
          <a
            className="content-reference-open"
            href={href || undefined}
            onClick={open}
          >
            <ExternalLink className="size-4" />
            <span>Open source</span>
          </a>
        </div>
        {expanded && (
          <div className="content-embed-content">
            {limited ? (
              <p className="content-reference-status">
                Open source to view this nested reference.
              </p>
            ) : blocks ? (
              <EmbedPath.Provider value={[...path, key]}>
                <TiptapEditor initialBlocks={blocks} />
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
      {preview?.status === "ready" &&
        preview.kind === "external" &&
        preview.imageUrl && (
          // biome-ignore lint/performance/noImgElement: arbitrary reference thumbnails use referrerPolicy and do not pass authenticated URLs to an optimizer.
          <img
            className="content-reference-thumbnail"
            src={safeEditorUrl(preview.imageUrl)}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}
      <div className="content-reference-card-body">
        <div className="content-reference-card-heading">
          <Icon className="content-reference-icon" />
          {link}
          {menu}
        </div>
        <p className="content-reference-card-excerpt">
          {preview?.status === "ready"
            ? preview.excerpt
            : isPending
              ? "Loading…"
              : "Referenced content is unavailable."}
        </p>
        <div className="content-reference-source">
          {preview?.status === "ready"
            ? preview.kind === "journal"
              ? "Journal entry"
              : preview.kind === "page"
                ? "Page"
                : new URL(props.url).hostname
            : ""}
        </div>
      </div>
    </article>
  );
}
