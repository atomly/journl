import {
  createReactBlockSpec,
  createReactInlineContentSpec,
} from "@blocknote/react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  type ReferenceEmbedBlock,
  type ReferenceEmbedResult,
  type ReferencePreviewData,
  ReferenceRenderContext,
  type ReferenceRenderTarget,
} from "./reference-context";
import {
  contentEmbedConfig,
  contentReferenceConfig,
  referenceCardConfig,
} from "./reference-config";
export { referenceProps } from "./reference-config";

function safeHref(url: string) {
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : "#";
  } catch {
    return "#";
  }
}

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
  if (props.targetKind === "external" && typeof props.url === "string") {
    try {
      const url = new URL(props.url);
      if (
        (url.protocol === "https:" || url.protocol === "http:") &&
        !url.username &&
        !url.password
      ) {
        return { kind: "external", url: url.toString() };
      }
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
    if (!enabled || !target || !adapter) return;
    let active = true;
    setLoading(true);
    void adapter
      .loadPreview(target)
      .then((result) => {
        if (active) setPreview(result);
      })
      .catch(() => {
        if (active) setPreview({ status: "unavailable" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [adapter, enabled, target]);
  return { adapter, loading, preview };
}

function ReferenceBadge({
  props,
  contentRef,
}: {
  props: Record<string, unknown>;
  contentRef: (element: HTMLElement | null) => void;
}) {
  const target = useMemo(() => targetFromProps(props), [props]);
  const elementRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const { adapter, loading, preview } = usePreview(target, active);
  const fallbackHref = typeof props.url === "string" ? props.url : "#";
  const href =
    preview?.status === "ready" ? (preview.href ?? fallbackHref) : undefined;
  const label =
    typeof props.label === "string" && props.label
      ? props.label
      : preview?.status === "ready"
        ? (preview.title ?? "Referenced content")
        : target?.kind === "external"
          ? new URL(target.url).hostname
          : "Referenced note";
  const registerElement = (element: HTMLElement | null) => {
    elementRef.current = element;
    contentRef(element);
  };
  return (
    <span className="content-reference-wrap" ref={registerElement}>
      <a
        className="content-reference"
        href={safeHref(href ?? fallbackHref)}
        rel="noopener noreferrer"
        target="_blank"
        onMouseEnter={() => setActive(true)}
        onFocus={() => setActive(true)}
        onClick={() => setActive(true)}
        onMouseLeave={(event) => {
          if (
            !event.currentTarget.parentElement?.contains(
              event.relatedTarget as Node | null,
            )
          ) {
            setActive(false);
          }
        }}
        onBlur={(event) => {
          if (
            !event.currentTarget.parentElement?.contains(
              event.relatedTarget as Node | null,
            )
          ) {
            setActive(false);
          }
        }}
        aria-label={`${label} reference`}
      >
        {label}
      </a>
      {active && (loading || preview) && (
        <span
          className="content-reference-preview"
          role="dialog"
          aria-label={`${label} preview`}
        >
          {loading
            ? "Loading preview…"
            : preview?.status === "unavailable"
              ? "Content unavailable"
              : `${preview?.title ?? label}${preview?.excerpt ? ` — ${preview.excerpt}` : ""}`}
          {href && adapter && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => target && adapter.openTarget(target, href)}
            >
              Open
            </button>
          )}
          {target && adapter && (
            <div className="content-reference-display-actions">
              {target.kind === "document" && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const blockId =
                      elementRef.current?.closest<HTMLElement>("[data-id]")
                        ?.dataset.id;
                    if (blockId)
                      adapter.convertInline(
                        blockId,
                        target,
                        "contentEmbed",
                        label,
                        href ?? fallbackHref,
                      );
                  }}
                >
                  Display as embed
                </button>
              )}
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const blockId =
                    elementRef.current?.closest<HTMLElement>("[data-id]")
                      ?.dataset.id;
                  if (blockId)
                    adapter.convertInline(
                      blockId,
                      target,
                      "referenceCard",
                      label,
                      href ?? fallbackHref,
                    );
                }}
              >
                Display as card
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const blockId =
                    elementRef.current?.closest<HTMLElement>("[data-id]")
                      ?.dataset.id;
                  if (blockId)
                    adapter.convertInline(
                      blockId,
                      target,
                      "link",
                      label,
                      href ?? fallbackHref,
                    );
                }}
              >
                Display as link
              </button>
            </div>
          )}
        </span>
      )}
    </span>
  );
}

function ReferenceCardView({
  block,
}: {
  block: { id: string; props: Record<string, unknown> };
}) {
  const props = block.props;
  const target = useMemo(() => targetFromProps(props), [props]);
  const { adapter, loading, preview } = usePreview(target, true);
  const label = typeof props.label === "string" ? props.label : "";
  const title =
    ((preview?.status === "ready" ? preview.title : undefined) ?? label) ||
    "Referenced content";
  const href =
    (preview?.status === "ready" ? preview.href : undefined) ??
    safeHref(String(props.url ?? "#"));
  return (
    <article
      className="content-reference-card"
      aria-label={`${title} reference card`}
    >
      <div className="content-reference-card-heading">
        <span aria-hidden="true">
          {target?.kind === "external" ? "↗" : "▤"}
        </span>
        <a href={href} rel="noopener noreferrer" target="_blank">
          {title}
        </a>
      </div>
      <p className="content-reference-card-excerpt">
        {loading
          ? "Loading preview…"
          : preview?.status === "unavailable"
            ? "Content unavailable"
            : preview?.excerpt ||
              (typeof props.url === "string" ? props.url : "")}
      </p>
      {preview?.status === "ready" && adapter && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => target && adapter.openTarget(target, href)}
        >
          Open source
        </button>
      )}
      {adapter && target && (
        <div className="content-reference-display-actions">
          {target.kind === "document" && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                adapter.convertBlock(
                  block.id,
                  target,
                  "contentEmbed",
                  title,
                  href,
                )
              }
            >
              Display as embed
            </button>
          )}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              adapter.convertBlock(block.id, target, "link", title, href)
            }
          >
            Display as link
          </button>
        </div>
      )}
    </article>
  );
}

function renderInline(value: unknown, key: number): React.ReactNode {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((child, index) => renderInline(child, index));
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type === "text")
    return <span key={key}>{String(record.text ?? "")}</span>;
  if (record.type === "link") {
    return (
      <a key={key} href={safeHref(String(record.href ?? "#"))}>
        {renderInline(record.content, key + 1)}
      </a>
    );
  }
  if (record.type === "contentReference") {
    return (
      <span key={key}>
        {String(
          (record.props as Record<string, unknown> | undefined)?.label ??
            "Referenced note",
        )}
      </span>
    );
  }
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
        if (block.type === "heading") {
          const level = Number(block.props?.level ?? 2);
          if (level === 1) return <h1 key={key}>{content}</h1>;
          if (level === 3) return <h3 key={key}>{content}</h3>;
          return <h2 key={key}>{content}</h2>;
        }
        if (
          ["bulletListItem", "numberedListItem", "checkListItem"].includes(
            block.type,
          )
        ) {
          return (
            <div key={key} className="content-embed-list-item">
              • {content}
            </div>
          );
        }
        if (block.type === "codeBlock")
          return (
            <pre key={key}>
              <code>{String(block.content ?? "")}</code>
            </pre>
          );
        if (block.type === "quote")
          return <blockquote key={key}>{content}</blockquote>;
        if (block.type === "divider") return <hr key={key} />;
        if (block.type === "contentEmbed") {
          return (
            <ReferenceEmbedView
              key={key}
              props={block.props ?? {}}
              depth={depth + 1}
              ancestorKeys={ancestorKeys}
            />
          );
        }
        if (block.type === "referenceCard") {
          return (
            <p key={key}>
              {String(
                block.props?.label ?? block.props?.url ?? "Referenced content",
              )}
            </p>
          );
        }
        return (
          <p key={key}>
            {content || (block.type === "table" ? "Table content" : "")}
          </p>
        );
      })}
    </div>
  );
}

function ReferenceEmbedView({
  props,
  blockId,
  depth,
  ancestorKeys,
}: {
  props: Record<string, unknown>;
  blockId?: string;
  depth: number;
  ancestorKeys: Set<string>;
}) {
  const target = useMemo(() => targetFromProps(props), [props]);
  const adapter = useContext(ReferenceRenderContext);
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<ReferenceEmbedResult>();
  const [requestCursor, setRequestCursor] = useState<string>();
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const key =
    target?.kind === "document"
      ? `${target.documentId}#${target.blockId ?? ""}`
      : "";
  const circular = Boolean(key && ancestorKeys.has(key));
  const limitReached = depth > 2;
  useEffect(() => {
    if (
      !expanded ||
      !target ||
      target.kind !== "document" ||
      !adapter ||
      circular ||
      limitReached
    )
      return;
    let active = true;
    setLoading(true);
    void adapter
      .loadEmbedContent(target, requestCursor)
      .then((result) => {
        if (!active) return;
        setContent((current) =>
          result.status === "ready" && requestCursor
            ? {
                ...result,
                blocks: [...(current?.blocks ?? []), ...(result.blocks ?? [])],
              }
            : result,
        );
        setNextCursor(result.nextCursor ?? undefined);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [adapter, circular, expanded, limitReached, requestCursor, target]);
  const title =
    typeof props.label === "string" && props.label
      ? props.label
      : "Embedded content";
  if (target?.kind !== "document") {
    return <div className="content-embed-fallback">{title}</div>;
  }
  if (circular) {
    return (
      <div className="content-embed-fallback">
        Circular reference ·{" "}
        <button type="button" onClick={() => adapter?.openTarget(target)}>
          Open source
        </button>
      </div>
    );
  }
  if (limitReached) {
    return (
      <div className="content-embed-fallback">
        {title} ·{" "}
        <button type="button" onClick={() => adapter?.openTarget(target)}>
          Open source
        </button>
      </div>
    );
  }
  const nextAncestors = new Set(ancestorKeys);
  nextAncestors.add(key);
  return (
    <section className="content-embed" aria-label={`${title} live embed`}>
      <header className="content-embed-heading">
        <strong>{content?.title ?? title}</strong>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => adapter?.openTarget(target, content?.href)}
        >
          Open source
        </button>
        {blockId && adapter && (
          <>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                adapter.convertBlock(
                  blockId,
                  target,
                  "referenceCard",
                  content?.title ?? title,
                  content?.href ?? "",
                )
              }
            >
              Display as card
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                adapter.convertBlock(
                  blockId,
                  target,
                  "link",
                  content?.title ?? title,
                  content?.href ?? "",
                )
              }
            >
              Display as link
            </button>
          </>
        )}
      </header>
      {expanded && (
        <>
          {loading && !content && <p>Loading embedded content…</p>}
          {content?.status === "unavailable" && <p>Content unavailable</p>}
          {content?.blocks && (
            <ReadOnlyBlocks
              blocks={content.blocks}
              depth={depth}
              ancestorKeys={nextAncestors}
            />
          )}
          {nextCursor && (
            <button
              type="button"
              disabled={loading}
              onClick={() => setRequestCursor(nextCursor)}
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          )}
        </>
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

export const referenceCard = createReactBlockSpec(
  referenceCardConfig,
  {
    render: ({ block }) => <ReferenceCardView block={block} />,
    toExternalHTML: ({ block }) => (
      <a href={safeHref(block.props.url)}>
        {block.props.label || block.props.url || "Referenced content"}
      </a>
    ),
  },
);

export const contentEmbed = createReactBlockSpec(
  contentEmbedConfig,
  {
    render: ({ block }) => (
      <ReferenceEmbedView
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
  },
);
