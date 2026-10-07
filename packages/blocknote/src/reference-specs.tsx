import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  createReactBlockSpec,
  createReactInlineContentSpec,
  useComponentsContext,
  usePortalElement,
} from "@blocknote/react";
import {
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  contentEmbedConfig,
  contentReferenceConfig,
  referenceCardConfig,
} from "./reference-config";
import {
  type ReferenceEmbedBlock,
  type ReferenceEmbedResult,
  type ReferencePreviewData,
  ReferenceRenderContext,
  type ReferenceRenderTarget,
} from "./reference-context";
import { safeReferenceHref as safeHref } from "./reference-href";

export { referenceProps } from "./reference-config";

function targetFromProps(
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

function usePreview(target: ReferenceRenderTarget | null, enabled: boolean) {
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

function ReferenceIcon({ target }: { target: ReferenceRenderTarget | null }) {
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

type Display = "contentEmbed" | "contentReference" | "referenceCard" | "link";
function DisplayMenu({
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
    <Menu.Root
      portalElement={portalElement}
      position="bottom-end"
      preventFocusOnOpen
    >
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

function fallbackTitle(target: ReferenceRenderTarget | null, url: string) {
  if (target?.kind === "external") {
    const parsed = new URL(target.url);
    return parsed.hostname === "github.com"
      ? `GitHub · ${parsed.pathname.slice(1) || "github.com"}`
      : `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  return target ? "Referenced note" : url || "Referenced content";
}

function inlineReferenceLabel(
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

function ReferenceBadge({
  props,
  contentRef,
  readOnly = false,
}: {
  props: Record<string, unknown>;
  contentRef: (element: HTMLElement | null) => void;
  readOnly?: boolean;
}) {
  const target = useMemo(() => targetFromProps(props), [props]);
  const elementRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLFieldSetElement | null>(null);
  const [active, setActive] = useState(false);
  const pinned = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const clearOpen = () => {
    clearTimeout(openTimer.current);
    openTimer.current = undefined;
  };
  const clearClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  };
  const close = () => {
    clearOpen();
    clearClose();
    pinned.current = false;
    setActive(false);
  };
  const enter = () => {
    clearClose();
    setActive(true);
  };
  const hover = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (event.buttons || !window.getSelection()?.isCollapsed) return;
    clearClose();
    clearOpen();
    openTimer.current = setTimeout(() => {
      if (window.getSelection()?.isCollapsed) enter();
    }, 250);
  };
  const leave = () => {
    clearOpen();
    if (pinned.current) return;
    clearClose();
    closeTimer.current = setTimeout(() => setActive(false), 160);
  };
  useEffect(() => {
    const cancel = () => {
      clearOpen();
      pinned.current = false;
      setActive(false);
    };
    const selection = () => {
      if (!window.getSelection()?.isCollapsed) cancel();
    };
    const pointer = (event: PointerEvent) => {
      if (
        !previewRef.current?.contains(event.target as Node) &&
        !elementRef.current?.contains(event.target as Node) &&
        !(
          event.target instanceof Element &&
          event.target.closest(".content-reference-display-menu")
        )
      )
        cancel();
    };
    document.addEventListener("selectionchange", selection);
    document.addEventListener("dragstart", cancel);
    document.addEventListener("pointerdown", pointer);
    return () => {
      clearOpen();
      clearClose();
      document.removeEventListener("selectionchange", selection);
      document.removeEventListener("dragstart", cancel);
      document.removeEventListener("pointerdown", pointer);
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const leaveFocus = (event: FocusEvent) => {
      const next = event.target;
      if (
        next instanceof Node &&
        !elementRef.current?.contains(next) &&
        !previewRef.current?.contains(next) &&
        !(
          next instanceof Element &&
          next.closest(".content-reference-display-menu")
        )
      ) {
        pinned.current = false;
        setActive(false);
      }
    };
    document.addEventListener("focusin", leaveFocus);
    return () => document.removeEventListener("focusin", leaveFocus);
  }, [active]);
  const Components = useComponentsContext();
  const portalElement = usePortalElement();
  const { adapter, loading, preview } = usePreview(target, true);
  const fallbackHref = typeof props.url === "string" ? props.url : "#";
  const href = safeHref(
    preview?.status === "ready" ? (preview.href ?? fallbackHref) : fallbackHref,
  );
  const authoredLabel = typeof props.label === "string" ? props.label : "";
  const label =
    authoredLabel ||
    inlineReferenceLabel(target, preview) ||
    fallbackTitle(target, fallbackHref);
  const sourceBlockId = () =>
    elementRef.current?.closest<HTMLElement>("[data-id]")?.dataset.id;
  const convert = (display: Display) => {
    const blockId = sourceBlockId();
    const inlineRoot = elementRef.current?.closest(".bn-inline-content");
    const badges = inlineRoot
      ? [...inlineRoot.querySelectorAll(".content-reference-wrap")]
      : [];
    const occurrenceIndex = badges.indexOf(elementRef.current as HTMLElement);
    if (blockId && target)
      adapter?.convertInline(
        blockId,
        target,
        display,
        display === "link" ? label : authoredLabel,
        href,
        occurrenceIndex < 0 ? undefined : occurrenceIndex,
      );
    close();
  };
  const badge = (
    <a
      className="content-reference"
      href={href}
      rel={target?.kind === "external" ? "noopener noreferrer" : undefined}
      target={target?.kind === "external" ? "_blank" : undefined}
      draggable={false}
      onMouseEnter={hover}
      onMouseLeave={leave}
      onClick={(event) => {
        if (!window.getSelection()?.isCollapsed) return;
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          pinned.current = true;
          enter();
        }
      }}
      aria-label={`${label} reference`}
    >
      <ReferenceIcon target={target} />
      <span>{label}</span>
    </a>
  );
  const blockId = sourceBlockId();
  const canConvert = Boolean(blockId && adapter?.canConvertInline?.(blockId));
  return (
    <span
      className="content-reference-wrap"
      ref={(element) => {
        elementRef.current = element;
        contentRef(element);
      }}
    >
      {Components ? (
        <Components.Generic.Popover.Root
          open={active}
          onOpenChange={(open) => {
            if (!open) close();
            else setActive(true);
          }}
          portalElement={portalElement}
        >
          <Components.Generic.Popover.Trigger>
            {badge}
          </Components.Generic.Popover.Trigger>
          <Components.Generic.Popover.Content
            className="content-reference-preview"
            variant="form-popover"
          >
            <fieldset
              aria-label="Reference preview"
              style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}
              ref={previewRef}
              onMouseEnter={clearClose}
              onMouseLeave={leave}
            >
              <div className="content-reference-card-heading">
                <ReferenceIcon target={target} />
                <strong>
                  {preview?.status === "ready"
                    ? (preview.title ?? label)
                    : label}
                </strong>
                <button
                  className="content-reference-action"
                  type="button"
                  aria-label="Close preview"
                  onClick={close}
                >
                  ×
                </button>
              </div>
              <p className="content-reference-card-excerpt">
                {loading
                  ? "Loading preview…"
                  : preview?.status === "unavailable"
                    ? "Content unavailable"
                    : preview?.excerpt || ""}
              </p>
              <div className="content-reference-preview-footer">
                {target && preview?.status === "ready" && (
                  <button
                    className="content-reference-open"
                    type="button"
                    onClick={() => adapter?.openTarget(target, href)}
                  >
                    Open {target.kind === "external" ? "link" : "note"}{" "}
                    <span aria-hidden="true">↗</span>
                  </button>
                )}
                {target && adapter?.editable && !readOnly && (
                  <DisplayMenu
                    onInteract={() => {
                      pinned.current = true;
                      clearClose();
                    }}
                    options={[
                      ...(canConvert && target.kind === "document"
                        ? ["contentEmbed" as const]
                        : []),
                      ...(canConvert ? ["referenceCard" as const] : []),
                      "link",
                    ]}
                    onChange={convert}
                  />
                )}
              </div>
            </fieldset>
          </Components.Generic.Popover.Content>
        </Components.Generic.Popover.Root>
      ) : (
        badge
      )}
    </span>
  );
}

// Use BlockNote's move path for the whole compact surface, just like its handle.
function blockSurface<
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

function ReferenceCardView<
  BS extends BlockSchema,
  IS extends InlineContentSchema,
  SS extends StyleSchema,
>({
  block,
  editor,
}: {
  block: { id?: string; props: Record<string, unknown> };
  editor?: BlockNoteEditor<BS, IS, SS>;
}) {
  const [failedImage, setFailedImage] = useState<string>();
  const props = block.props;
  const target = useMemo(() => targetFromProps(props), [props]);
  const { adapter, loading, preview } = usePreview(target, true);
  const authoredLabel = typeof props.label === "string" ? props.label : "";
  const title =
    (preview?.status === "ready" ? preview.title : undefined) ||
    authoredLabel ||
    fallbackTitle(target, String(props.url ?? ""));
  const href = safeHref(
    (preview?.status === "ready" ? preview.href : undefined) ??
      String(props.url ?? "#"),
  );
  return (
    <article
      className="content-reference-card"
      {...blockSurface(editor, block.id, adapter?.editable)}
      aria-label={`${title} reference card`}
    >
      {preview?.status === "ready" &&
        preview.imageUrl &&
        preview.imageUrl !== failedImage && (
          <img
            key={preview.imageUrl}
            className="content-reference-thumbnail"
            draggable={false}
            onError={() => setFailedImage(preview.imageUrl)}
            src={safeHref(preview.imageUrl)}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}
      <div className="content-reference-card-body">
        <div className="content-reference-card-heading">
          <ReferenceIcon target={target} />
          <a
            draggable={false}
            href={href}
            rel={
              target?.kind === "external" ? "noopener noreferrer" : undefined
            }
            target={target?.kind === "external" ? "_blank" : undefined}
            onClick={(event) => {
              if (adapter && target && !event.metaKey && !event.ctrlKey) {
                event.preventDefault();
                adapter.openTarget(target, href);
              }
            }}
          >
            {title}
          </a>
          {block.id && adapter?.editable && target && (
            <DisplayMenu
              options={[
                ...(target.kind === "document"
                  ? ["contentEmbed" as const]
                  : []),
                "contentReference",
                "link",
              ]}
              onChange={(display) =>
                adapter.convertBlock(
                  block.id as string,
                  target,
                  display,
                  display === "link" ? title : authoredLabel,
                  href,
                )
              }
            />
          )}
        </div>
        <p className="content-reference-card-excerpt">
          {loading
            ? "Loading preview…"
            : preview?.status === "unavailable"
              ? "Content unavailable"
              : preview?.excerpt || String(props.url ?? "")}
        </p>
        <span className="content-reference-source">
          {preview?.kind === "journal"
            ? "Journal entry"
            : preview?.kind === "page"
              ? "Page"
              : target?.kind === "external"
                ? new URL(target.url).hostname
                : "Note"}
          {preview?.sourceStatus ? ` · ${preview.sourceStatus}` : ""}
        </span>
      </div>
    </article>
  );
}

function renderInline(value: unknown, key: number): ReactNode {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map((child, index) => renderInline(child, index));
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type === "text") {
    const styles = (record.styles ?? {}) as Record<string, unknown>;
    let text: ReactNode = String(record.text ?? "");
    if (styles.bold) text = <strong>{text}</strong>;
    if (styles.italic) text = <em>{text}</em>;
    if (styles.underline) text = <u>{text}</u>;
    if (styles.strike) text = <s>{text}</s>;
    if (styles.code) text = <code>{text}</code>;
    return <span key={key}>{text}</span>;
  }
  if (record.type === "link")
    return (
      <a key={key} href={safeHref(String(record.href ?? "#"))}>
        {renderInline(record.content, key + 1)}
      </a>
    );
  if (record.type === "contentReference")
    return (
      <ReferenceBadge
        key={key}
        props={(record.props ?? {}) as Record<string, unknown>}
        contentRef={() => {}}
        readOnly
      />
    );
  return null;
}

function ReadOnlyBlocks({
  blocks,
  depth,
  ancestorKeys,
}: {
  blocks: ReferenceEmbedBlock[];
  depth: number;
  ancestorKeys: Set<string>;
}) {
  return (
    <div className="content-embed-body">
      {blocks.map((block, index) => {
        const key = block.id ?? `${block.type}-${index}`;
        const content = renderInline(block.content, index);
        let element: ReactNode;
        if (block.type === "heading") {
          const level = Number(block.props?.level ?? 2);
          element =
            level === 1 ? (
              <h1>{content}</h1>
            ) : level === 3 ? (
              <h3>{content}</h3>
            ) : (
              <h2>{content}</h2>
            );
        } else if (
          ["bulletListItem", "numberedListItem", "checkListItem"].includes(
            block.type,
          )
        ) {
          const marker =
            block.type === "checkListItem" ? (
              <input
                type="checkbox"
                checked={Boolean(block.props?.checked)}
                disabled
                aria-label="Embedded checklist item"
              />
            ) : block.type === "numberedListItem" ? (
              `${Number(block.props?.start ?? index + 1)}.`
            ) : (
              "•"
            );
          element = (
            <div className="content-embed-list-item">
              <span>{marker}</span>
              <div>{content}</div>
            </div>
          );
        } else if (block.type === "codeBlock")
          element = (
            <pre>
              <code>{content}</code>
            </pre>
          );
        else if (block.type === "quote")
          element = <blockquote>{content}</blockquote>;
        else if (block.type === "divider") element = <hr />;
        else if (block.type === "contentEmbed")
          element = (
            <ReferenceEmbedView
              props={block.props ?? {}}
              depth={depth + 1}
              ancestorKeys={ancestorKeys}
            />
          );
        else if (block.type === "referenceCard")
          element = <ReferenceCardView block={{ props: block.props ?? {} }} />;
        else if (block.type === "table") {
          const table = block.content as
            | { rows?: Array<{ cells?: unknown[] }> }
            | undefined;
          element = (
            <div className="content-embed-table">
              <table>
                <tbody>
                  {table?.rows?.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {row.cells?.map((cell, cellIndex) => (
                        <td key={`cell-${cellIndex}`}>
                          {renderInline(
                            cell &&
                              typeof cell === "object" &&
                              !Array.isArray(cell)
                              ? (cell as Record<string, unknown>).content
                              : cell,
                            cellIndex,
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        } else element = <p>{content}</p>;
        return (
          <div
            key={key}
            style={{
              paddingInlineStart: `${Math.min(block.depth ?? 0, 6) * 1.25}rem`,
            }}
          >
            {element}
          </div>
        );
      })}
    </div>
  );
}

function ReferenceEmbedView<
  BS extends BlockSchema,
  IS extends InlineContentSchema,
  SS extends StyleSchema,
>({
  props,
  blockId,
  editor,
  depth,
  ancestorKeys,
}: {
  props: Record<string, unknown>;
  blockId?: string;
  editor?: BlockNoteEditor<BS, IS, SS>;
  depth: number;
  ancestorKeys: Set<string>;
}) {
  const target = useMemo(() => targetFromProps(props), [props]);
  const { adapter, preview } = usePreview(target, true);
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<ReferenceEmbedResult>();
  const [requestCursor, setRequestCursor] = useState<string>();
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const key =
    target?.kind === "document"
      ? `${target.documentId}#${target.blockId ?? ""}`
      : "";
  const circular = Boolean(key && ancestorKeys.has(key));
  const limitReached = depth > 2;
  useEffect(() => {
    setContent(undefined);
    setRequestCursor(undefined);
    setNextCursor(undefined);
    setExpanded(false);
  }, [key]);
  useEffect(() => {
    if (
      !expanded ||
      target?.kind !== "document" ||
      !adapter ||
      circular ||
      limitReached
    )
      return;
    let active = true;
    setLoading(true);
    setFailed(false);
    const receive = (result: ReferenceEmbedResult | null) => {
      if (!active) return;
      setLoading(false);
      if (!result) {
        setFailed(true);
        return;
      }
      setContent((current) =>
        result.status === "ready" &&
        requestCursor &&
        current?.contentUpdatedAt === result.contentUpdatedAt
          ? {
              ...result,
              blocks: [
                ...new Map(
                  [...(current?.blocks ?? []), ...(result.blocks ?? [])].map(
                    (block) => [block.id, block],
                  ),
                ).values(),
              ],
            }
          : result,
      );
      setNextCursor(result.nextCursor ?? undefined);
    };
    const unsubscribe = adapter.subscribeEmbedContent?.(
      target,
      requestCursor,
      receive,
    );
    if (!unsubscribe)
      void adapter
        .loadEmbedContent(target, requestCursor)
        .then(receive)
        .catch(() => receive(null));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [adapter, circular, expanded, limitReached, requestCursor, retry, target]);
  const authoredLabel = typeof props.label === "string" ? props.label : "";
  const title =
    content?.title ||
    (preview?.status === "ready" ? preview.title : undefined) ||
    authoredLabel ||
    "Embedded note";
  const href =
    content?.href ?? (preview?.status === "ready" ? preview.href : undefined);
  if (target?.kind !== "document")
    return <div className="content-embed-fallback">{title}</div>;
  if (circular || limitReached)
    return (
      <div className="content-embed-fallback">
        {circular ? "Circular reference" : title}
        <button
          className="content-reference-open"
          type="button"
          onClick={() => adapter?.openTarget(target, href)}
        >
          Open source ↗
        </button>
      </div>
    );
  const nextAncestors = new Set(ancestorKeys);
  nextAncestors.add(key);
  return (
    <section
      className="content-embed"
      {...blockSurface(editor, blockId, adapter?.editable)}
      aria-label={`${title} live embed`}
    >
      <header className="content-embed-heading">
        <button
          className="content-embed-toggle"
          type="button"
          aria-expanded={expanded}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setExpanded((value) => !value);
            if (expanded) setRequestCursor(undefined);
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: expanded ? "rotate(90deg)" : undefined }}
          >
            <path d="m9 5 7 7-7 7" />
          </svg>
          <ReferenceIcon target={target} />
          <strong>{title}</strong>
        </button>
        <button
          className="content-reference-action"
          type="button"
          aria-label="Open source note"
          title="Open source note"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => adapter?.openTarget(target, href)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
          </svg>
        </button>
        {blockId && adapter?.editable && (
          <DisplayMenu
            options={["referenceCard", "contentReference", "link"]}
            onChange={(display) =>
              adapter.convertBlock(
                blockId,
                target,
                display,
                display === "link" ? title : authoredLabel,
                href ?? String(props.url ?? ""),
              )
            }
          />
        )}
      </header>
      {expanded && (
        <div className="content-embed-content">
          {loading && !content && (
            <p className="content-reference-status" role="status">
              Loading embedded content…
            </p>
          )}
          {failed && (
            <p className="content-reference-status" role="status">
              Could not load this note.{" "}
              <button
                className="content-reference-open"
                type="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Retry
              </button>
            </p>
          )}
          {content?.status === "unavailable" && (
            <p className="content-reference-status">Content unavailable</p>
          )}
          {content?.blocks && (
            <ReadOnlyBlocks
              blocks={content.blocks}
              depth={depth}
              ancestorKeys={nextAncestors}
            />
          )}
          {nextCursor && (
            <button
              className="content-reference-open"
              type="button"
              disabled={loading}
              onClick={() => setRequestCursor(nextCursor)}
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export const contentReference = createReactInlineContentSpec(
  contentReferenceConfig,
  {
    render: ({ inlineContent, contentRef }) => (
      <ReferenceBadge
        props={inlineContent.props}
        contentRef={(element) => contentRef(element)}
      />
    ),
    toExternalHTML: ({ inlineContent }) => (
      <a href={safeHref(inlineContent.props.url)}>
        {inlineContent.props.label ||
          inlineContent.props.url ||
          "Referenced content"}
      </a>
    ),
  },
);

export const referenceCard = createReactBlockSpec(referenceCardConfig, {
  render: ({ block, editor }) => (
    <ReferenceCardView block={block} editor={editor} />
  ),
  toExternalHTML: ({ block }) => (
    <a href={safeHref(block.props.url)}>
      {block.props.label || block.props.url || "Referenced content"}
    </a>
  ),
});

export const contentEmbed = createReactBlockSpec(contentEmbedConfig, {
  render: ({ block, editor }) => (
    <ReferenceEmbedView
      editor={editor}
      blockId={block.id}
      props={block.props}
      depth={1}
      ancestorKeys={new Set()}
    />
  ),
  toExternalHTML: ({ block }) => (
    <a href={safeHref(block.props.url)}>
      {block.props.label || block.props.url || "Embedded content"}
    </a>
  ),
});
