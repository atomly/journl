import {
  createReactBlockSpec,
  createReactInlineContentSpec,
} from "@blocknote/react";
import {
  contentEmbedConfig,
  contentReferenceConfig,
  referenceCardConfig,
} from "./reference-config";
import { safeReferenceHref as safeHref } from "./reference-href";

export { referenceProps } from "./reference-config";

import { ReferenceBadge } from "./reference-badge";
import { ReferenceCardView } from "./reference-card";
import { ReferenceEmbedView } from "./reference-embed";
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
