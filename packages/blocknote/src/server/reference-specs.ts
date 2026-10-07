import {
  createBlockSpec,
  createInlineContentSpec,
} from "@blocknote/core";
import {
  contentEmbedConfig,
  contentReferenceConfig,
  referenceCardConfig,
} from "../reference-config";

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

function linkElement(url: string, label: string) {
  const link = document.createElement("a");
  link.href = safeHref(url);
  link.textContent = label || url || "Referenced content";
  return link;
}

export const contentReference = createInlineContentSpec(
  contentReferenceConfig,
  {
    render: (inlineContent) => ({
      dom: linkElement(
        inlineContent.props.url,
        inlineContent.props.label || inlineContent.props.url,
      ),
    }),
    toExternalHTML: (inlineContent) => ({
      dom: linkElement(
        inlineContent.props.url,
        inlineContent.props.label || inlineContent.props.url,
      ),
    }),
  },
);

function createReferenceBlock(type: "referenceCard" | "contentEmbed") {
  return createBlockSpec(
    type === "referenceCard" ? referenceCardConfig : contentEmbedConfig,
    {
      render(block) {
        return {
          dom: linkElement(
            block.props.url,
            block.props.label || block.props.url,
          ),
        };
      },
      toExternalHTML(block) {
        return {
          dom: linkElement(
            block.props.url,
            block.props.label || block.props.url,
          ),
        };
      },
    },
  )();
}

export const referenceCard = createReferenceBlock("referenceCard");
export const contentEmbed = createReferenceBlock("contentEmbed");
