import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import { useEffect, useMemo, useState } from "react";
import { type ReferenceEmbedResult } from "./reference-context";

export { referenceProps } from "./reference-config";

import {
  targetFromProps,
  usePreview,
  ReferenceIcon,
  DisplayMenu,
  blockSurface,
} from "./reference-render-helpers";
import { ReadOnlyBlocks } from "./reference-read-only";
export function ReferenceEmbedView<
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
