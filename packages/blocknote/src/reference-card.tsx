import { PreviewImage, PreviewStatus } from "@acme/references/react";
import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import { useMemo } from "react";
import { safeReferenceHref as safeHref } from "./reference-href";

import {
  blockSurface,
  DisplayMenu,
  fallbackTitle,
  ReferenceIcon,
  targetFromProps,
  usePreview,
} from "./reference-render-helpers";
export function ReferenceCardView<
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
  const props = block.props;
  const target = useMemo(() => targetFromProps(props), [props]);
  const { adapter, loading, preview } = usePreview(target, true);
  const targetUnavailable = preview?.unavailableReason === "target-unavailable";
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
      <PreviewImage
        className="content-reference-thumbnail"
        src={preview?.status === "ready" ? preview.imageUrl : undefined}
      />
      <div className="content-reference-card-body">
        <div className="content-reference-card-heading">
          <ReferenceIcon target={target} preview={preview} />
          <a
            draggable={false}
            href={targetUnavailable ? undefined : href}
            rel={
              target?.kind === "external" ? "noopener noreferrer" : undefined
            }
            target={target?.kind === "external" ? "_blank" : undefined}
            onClick={(event) => {
              if (targetUnavailable) {
                event.preventDefault();
                return;
              }
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
        <PreviewStatus
          className="content-reference-card-excerpt"
          loading={loading}
          unavailable={preview?.status === "unavailable"}
          targetUnavailable={targetUnavailable}
        >
          {preview?.excerpt || String(props.url ?? "")}
        </PreviewStatus>
        <span className="content-reference-source">
          {preview?.kind === "journal"
            ? "Journal entry"
            : preview?.kind === "page"
              ? "Page"
              : target?.kind === "external"
                ? (preview?.sourceLabel ?? new URL(target.url).hostname)
                : "Note"}
          {preview?.sourceStatus ? ` · ${preview.sourceStatus}` : ""}
        </span>
      </div>
    </article>
  );
}
