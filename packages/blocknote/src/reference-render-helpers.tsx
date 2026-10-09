import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { useComponentsContext, usePortalElement } from "@blocknote/react";
import {
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type ReferencePreviewData,
  ReferenceRenderContext,
  type ReferenceRenderTarget,
} from "./reference-context";
import { safeReferenceHref as safeHref } from "./reference-href";

export { referenceProps } from "./reference-config";

export function targetFromProps(
  props: Record<string, unknown>,
): ReferenceRenderTarget | null {
  if (props.version !== 1) return null;
  if (
    props.targetKind === "document" &&
    typeof props.documentId === "string" &&
    /^[0-9a-f-]{36}$/i.test(props.documentId)
  ) {
    return {
      documentId: props.documentId,
      kind: "document",
      ...(typeof props.blockId === "string" &&
      /^[0-9a-f-]{36}$/i.test(props.blockId)
        ? { blockId: props.blockId }
        : {}),
    };
  }
  if (
    props.targetKind === "external" &&
    typeof props.url === "string" &&
    safeHref(props.url) !== "#"
  ) {
    try {
      return { kind: "external", url: new URL(props.url).toString() };
    } catch {
      return null;
    }
  }
  return null;
}

export function usePreview(
  target: ReferenceRenderTarget | null,
  enabled: boolean,
) {
  const adapter = useContext(ReferenceRenderContext);
  const [preview, setPreview] = useState<ReferencePreviewData>();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setPreview(undefined);
    if (!enabled || !target || !adapter) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const receive = (result: ReferencePreviewData) => {
      if (active) {
        setPreview(result);
        setLoading(false);
      }
    };
    const unsubscribe = adapter.subscribePreview?.(target, receive);
    if (!unsubscribe)
      void adapter
        .loadPreview(target)
        .then(receive)
        .catch(() => receive({ status: "unavailable" }));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [adapter, enabled, target]);
  return { adapter, loading, preview };
}

export function ReferenceIcon({
  target,
}: {
  target: ReferenceRenderTarget | null;
}) {
  const github =
    target?.kind === "external" &&
    new URL(target.url).hostname === "github.com";
  return (
    <svg
      className="content-reference-icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {github &&
      target?.kind === "external" &&
      new URL(target.url).pathname.match(/^\/[^/]+\/[^/]+\/pull\/\d+/) ? (
        <>
          <circle cx="6" cy="5" r="2" />
          <circle cx="6" cy="19" r="2" />
          <circle cx="18" cy="19" r="2" />
          <path d="M6 7v10M18 17V9a4 4 0 0 0-4-4h-2m2-2-2 2 2 2" />
        </>
      ) : github &&
        target?.kind === "external" &&
        new URL(target.url).pathname.match(/^\/[^/]+\/[^/]+\/issues\/\d+/) ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </>
      ) : github ? (
        <path d="M9 19c-4.3 1.3-4.3-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-1-2.7c3.3-.4 6.8-1.6 6.8-7A5.4 5.4 0 0 0 19.3 5a5 5 0 0 0-.1-3.4s-1.2-.4-3.9 1.5a13.4 13.4 0 0 0-7 0C5.6 1.2 4.4 1.6 4.4 1.6A5 5 0 0 0 4.3 5a5.4 5.4 0 0 0-1.5 3.7c0 5.4 3.5 6.6 6.8 7a3.4 3.4 0 0 0-1 2.7V22" />
      ) : target?.kind === "external" ? (
        <>
          <path d="M15 3h6v6M10 14 21 3" />
          <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
        </>
      ) : (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h6" />
        </>
      )}
    </svg>
  );
}

export type Display =
  | "contentEmbed"
  | "contentReference"
  | "referenceCard"
  | "link";
export function DisplayMenu({
  options,
  onChange,
  onInteract,
}: {
  options: Display[];
  onInteract?: () => void;
  onChange: (display: Display) => void;
}) {
  const Components = useComponentsContext();
  const portalElement = usePortalElement();
  if (!Components || !options.length) return null;
  const Menu = Components.Generic.Menu;
  return (
    <Menu.Root portalElement={portalElement} position="bottom-end">
      <Menu.Trigger>
        <button
          type="button"
          className="content-reference-action"
          aria-label="Reference display options"
          title="Display as"
          onClick={onInteract}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
      </Menu.Trigger>
      <Menu.Dropdown className="content-reference-display-menu">
        <Menu.Label>Display as</Menu.Label>
        {options.map((display) => (
          <Menu.Item key={display} onClick={() => onChange(display)}>
            {display === "contentEmbed"
              ? "Embed"
              : display === "referenceCard"
                ? "Card"
                : display === "contentReference"
                  ? "Inline"
                  : "Link"}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu.Root>
  );
}

export function fallbackTitle(
  target: ReferenceRenderTarget | null,
  url: string,
) {
  if (target?.kind === "external") {
    const parsed = new URL(target.url);
    return parsed.hostname === "github.com"
      ? `GitHub · ${parsed.pathname.slice(1) || "github.com"}`
      : `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  return target ? "Referenced note" : url || "Referenced content";
}

export function inlineReferenceLabel(
  target: ReferenceRenderTarget | null,
  preview: ReferencePreviewData | undefined,
) {
  if (target?.kind === "external") {
    const url = new URL(target.url);
    const match =
      url.hostname === "github.com"
        ? url.pathname.match(
            /^\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)(?:\/|$)/,
          )
        : null;
    if (match) return `${match[1]}/${match[2]} #${match[4]}`;
  }
  return preview?.status === "ready" && preview.metadataState !== "url-only"
    ? preview.title
    : undefined;
}

export function blockSurface<
  BS extends BlockSchema,
  IS extends InlineContentSchema,
  SS extends StyleSchema,
>(
  editor: BlockNoteEditor<BS, IS, SS> | undefined,
  id: string | undefined,
  editable: boolean | undefined,
) {
  const enabled = Boolean(editor && id && editable);
  const interactive = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(
      target.closest(
        "a, button, input, select, textarea, [role=button], .content-embed-content",
      ),
    );
  return {
    "data-block-surface": enabled ? "true" : undefined,
    draggable: enabled,
    onDragEnd() {
      editor?.getExtension(SideMenuExtension)?.blockDragEnd();
    },
    onDragStart(event: ReactDragEvent<HTMLElement>) {
      if (
        !(event.target instanceof Node) ||
        !event.currentTarget.contains(event.target)
      )
        return;
      if (!enabled || !editor || !id || interactive(event.target)) {
        event.preventDefault();
        return;
      }
      const block = editor.getBlock(id);
      if (block)
        editor.getExtension(SideMenuExtension)?.blockDragStart(event, block);
    },
    onMouseDown(event: ReactMouseEvent<HTMLElement>) {
      if (
        !enabled ||
        !editor ||
        !id ||
        !(event.target instanceof Node) ||
        !event.currentTarget.contains(event.target) ||
        event.button !== 0 ||
        interactive(event.target)
      )
        return;
      if (event.shiftKey) {
        const anchor =
          editor.getSelection()?.blocks[0]?.id ??
          editor.getTextCursorPosition().block.id;
        editor.setSelection(anchor, id);
      } else {
        editor._tiptapEditor.state.doc.descendants((node, pos) => {
          if (node.type.name === "blockContainer" && node.attrs.id === id) {
            editor._tiptapEditor.commands.setNodeSelection(pos + 1);
            return false;
          }
        });
      }
      editor.focus();
    },
  };
}
