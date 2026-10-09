export const referenceProps = {
  blockId: { default: "" },
  documentId: { default: "" },
  label: { default: "" },
  resolutionToken: { default: "" },
  targetKind: { default: "document", values: ["document", "external"] },
  url: { default: "" },
  version: { default: 1 },
} as const;

export const contentReferenceConfig = {
  content: "none",
  propSchema: referenceProps,
  type: "contentReference",
} as const;

export const referenceCardConfig = {
  content: "none",
  propSchema: referenceProps,
  type: "referenceCard",
} as const;

export const contentEmbedConfig = {
  content: "none",
  propSchema: referenceProps,
  type: "contentEmbed",
} as const;
