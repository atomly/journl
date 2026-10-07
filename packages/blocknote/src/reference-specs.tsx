import {
  createReactBlockSpec,
  createReactInlineContentSpec,
} from "@blocknote/react";

export const referenceProps = {
  blockId: { default: "" },
  documentId: { default: "" },
  label: { default: "" },
  targetKind: { default: "document", values: ["document", "external"] },
  url: { default: "" },
  version: { default: 1 },
} as const;

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

export const contentReference = createReactInlineContentSpec(
  {
    content: "none",
    propSchema: referenceProps,
    type: "contentReference",
  },
  {
    render: ({ inlineContent, contentRef }) => (
      <a
        className="content-reference"
        href={safeHref(inlineContent.props.url)}
        ref={contentRef}
        rel="noopener noreferrer"
        target="_blank"
      >
        {inlineContent.props.label || "Referenced content"}
      </a>
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
  {
    content: "none",
    propSchema: referenceProps,
    type: "referenceCard",
  },
  {
    render: ({ block }) => (
      <a
        className="content-reference-card"
        href={safeHref(block.props.url)}
        rel="noopener noreferrer"
        target="_blank"
      >
        <strong>{block.props.label || "Referenced content"}</strong>
        <span>{block.props.url}</span>
      </a>
    ),
    toExternalHTML: ({ block }) => (
      <a href={safeHref(block.props.url)}>
        {block.props.label || block.props.url || "Referenced content"}
      </a>
    ),
  },
);

export const contentEmbed = createReactBlockSpec(
  {
    content: "none",
    propSchema: referenceProps,
    type: "contentEmbed",
  },
  {
    render: ({ block }) => (
      <a
        className="content-embed"
        href={safeHref(block.props.url)}
        rel="noopener noreferrer"
        target="_blank"
      >
        {block.props.label || "Open embedded content"}
      </a>
    ),
    toExternalHTML: ({ block }) => (
      <a href={safeHref(block.props.url)}>
        {block.props.label || block.props.url || "Embedded content"}
      </a>
    ),
  },
);
