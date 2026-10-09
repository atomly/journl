import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import { useMemo, useState } from "react";
import { safeReferenceHref as safeHref } from "./reference-href";

export { referenceProps } from "./reference-config";

import {
  targetFromProps,
  usePreview,
  ReferenceIcon,
  DisplayMenu,
  fallbackTitle,
  blockSurface,
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
