import type { DocumentBlock } from "./schema";

/** Synthetic only. IDs and example.invalid URLs contain no application/user data. */
export const inventoryId = (n: number) =>
  `36900000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const inventoryDocumentId = inventoryId(999999);
const text = (value: string) => ({
  styles: {},
  text: value,
  type: "text" as const,
});
export const inventoryReference = {
  blockId: "",
  documentId: inventoryDocumentId,
  label: "Synthetic referenced note",
  resolutionToken: "",
  targetKind: "document",
  url: `/pages/${inventoryDocumentId}`,
  version: 1,
} as const;
const externalReference = {
  ...inventoryReference,
  documentId: "",
  label: "Synthetic external reference",
  targetKind: "external",
  url: "https://example.invalid/reference?q=inventory#section",
} as const;

/** Every installed default block, all styles, both table cell shapes, nesting and references. */
export const parityBlocks: [DocumentBlock, ...DocumentBlock[]] = [
  {
    content: [
      {
        ...text("Styled writing 世界 👩🏽‍💻 é\nsecond line"),
        styles: {
          backgroundColor: "#ffeeaa",
          bold: true,
          code: true,
          italic: true,
          strike: true,
          textColor: "red",
          underline: true,
        },
      },
      {
        content: [text("Native link")],
        href: "https://example.invalid/a?b=c#part",
        type: "link",
      },
      { props: inventoryReference, type: "contentReference" },
      {
        props: {
          ...inventoryReference,
          blockId: inventoryId(21),
          label: "Block target",
          url: `${inventoryReference.url}#block=${inventoryId(21)}`,
        },
        type: "contentReference",
      },
      { props: externalReference, type: "contentReference" },
    ],
    id: inventoryId(1),
    props: {
      backgroundColor: "yellow",
      textAlignment: "justify",
      textColor: "blue",
    },
    type: "paragraph",
  },
  ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
    content: `Heading ${level}`,
    id: inventoryId(10 + level),
    props: { level },
    type: "heading" as const,
  })),
  {
    children: [
      {
        content: "Toggle heading child",
        id: inventoryId(18),
        type: "paragraph",
      },
    ],
    content: "Toggle heading",
    id: inventoryId(17),
    props: { isToggleable: true, level: 2 },
    type: "heading",
  },
  {
    children: [
      {
        children: [
          {
            content: "Checked grandchild",
            id: inventoryId(22),
            props: { checked: true },
            type: "checkListItem",
          },
          {
            content: "Unchecked sibling",
            id: inventoryId(23),
            props: { checked: false },
            type: "checkListItem",
          },
        ],
        content: "Numbered child",
        id: inventoryId(21),
        props: { start: 7 },
        type: "numberedListItem",
      },
      {
        content: "Nested paragraph after list",
        id: inventoryId(24),
        type: "paragraph",
      },
    ],
    content: "Parent bullet",
    id: inventoryId(20),
    type: "bulletListItem",
  },
  {
    children: [
      { content: "Toggle child", id: inventoryId(26), type: "paragraph" },
    ],
    content: "Toggle list",
    id: inventoryId(25),
    type: "toggleListItem",
  },
  {
    content: 'const literal = "[[not a reference]]";\nconsole.log(literal);',
    id: inventoryId(30),
    props: { language: "typescript" },
    type: "codeBlock",
  },
  {
    children: [
      {
        content: "Nested quote context",
        id: inventoryId(32),
        type: "paragraph",
      },
    ],
    content: "A synthetic quote",
    id: inventoryId(31),
    type: "quote",
  },
  { id: inventoryId(33), type: "divider" },
  {
    content: {
      columnWidths: [180, undefined],
      headerRows: 1,
      rows: [
        {
          cells: [
            [text("Legacy array cell")],
            [{ props: inventoryReference, type: "contentReference" }],
          ],
        },
        {
          cells: [
            [text("Second row")],
            [
              {
                content: [text("Table link")],
                href: "https://example.invalid/table",
                type: "link",
              },
            ],
          ],
        },
      ],
      type: "tableContent",
    },
    id: inventoryId(40),
    type: "table",
  },
  {
    content: {
      columnWidths: [140, 160],
      headerCols: 1,
      headerRows: 1,
      rows: [
        {
          cells: [
            {
              content: [text("Merged heading")],
              props: {
                backgroundColor: "yellow",
                colspan: 2,
                rowspan: 1,
                textAlignment: "center",
                textColor: "purple",
              },
              type: "tableCell",
            },
          ],
        },
        {
          cells: [
            {
              content: [text("Modern cell")],
              props: {
                backgroundColor: "default",
                textAlignment: "left",
                textColor: "default",
              },
              type: "tableCell",
            },
            {
              content: [{ props: externalReference, type: "contentReference" }],
              props: {
                backgroundColor: "default",
                textAlignment: "right",
                textColor: "red",
              },
              type: "tableCell",
            },
          ],
        },
      ],
      type: "tableContent",
    },
    id: inventoryId(41),
    type: "table",
  },
  {
    id: inventoryId(50),
    props: {
      caption: "Synthetic image caption",
      name: "inventory.svg",
      previewWidth: 320,
      showPreview: true,
      textAlignment: "center",
      url: "https://assets.example.invalid/inventory.svg",
    },
    type: "image",
  },
  {
    id: inventoryId(51),
    props: {
      caption: "Synthetic video caption",
      name: "inventory.mp4",
      previewWidth: 400,
      showPreview: false,
      url: "https://assets.example.invalid/inventory.mp4",
    },
    type: "video",
  },
  {
    id: inventoryId(52),
    props: {
      caption: "Synthetic audio caption",
      name: "inventory.mp3",
      showPreview: true,
      url: "https://assets.example.invalid/inventory.mp3",
    },
    type: "audio",
  },
  {
    id: inventoryId(53),
    props: {
      caption: "Synthetic file caption",
      name: "inventory.pdf",
      url: "https://assets.example.invalid/inventory.pdf",
    },
    type: "file",
  },
  { id: inventoryId(60), props: inventoryReference, type: "referenceCard" },
  { id: inventoryId(61), props: externalReference, type: "referenceCard" },
  {
    id: inventoryId(62),
    props: {
      ...inventoryReference,
      blockId: inventoryId(21),
      url: `${inventoryReference.url}#block=${inventoryId(21)}`,
    },
    type: "contentEmbed",
  },
  {
    content: [
      {
        props: {
          ...inventoryReference,
          documentId: inventoryId(999998),
          label: "Unavailable target",
          url: `/pages/${inventoryId(999998)}`,
        },
        type: "contentReference",
      },
    ],
    id: inventoryId(63),
    type: "paragraph",
  },
  { content: [], id: inventoryId(64), type: "paragraph" },
];

const timestamp = "2026-10-16 00:00:00+00";
export function savedNode(
  id: number,
  data: Record<string, unknown>,
  parentId: number | null = null,
) {
  return {
    created_at: timestamp,
    data,
    document_id: inventoryDocumentId,
    id: inventoryId(id),
    parent_id: parentId === null ? null : inventoryId(parentId),
    updated_at: timestamp,
    user_id: "synthetic-inventory",
  };
}
export function savedEdge(from: number, to: number) {
  return {
    created_at: timestamp,
    document_id: inventoryDocumentId,
    from_id: inventoryId(from),
    to_id: inventoryId(to),
    type: "sibling" as const,
    updated_at: timestamp,
    user_id: "synthetic-inventory",
  };
}

export const historicalFixtures = [
  {
    disposition: "load",
    edges: [],
    name: "missing-content",
    nodes: [savedNode(101, { props: {}, type: "paragraph" })],
  },
  {
    disposition: "load",
    edges: [],
    name: "missing-props",
    nodes: [
      savedNode(103, { content: "Props were omitted", type: "paragraph" }),
    ],
  },
  {
    disposition: "load",
    edges: [],
    name: "string-content",
    nodes: [
      savedNode(102, {
        content: "Older string-shaped writing",
        props: {},
        type: "paragraph",
      }),
    ],
  },
  {
    disposition: "load",
    edges: [savedEdge(111, 113)],
    name: "sibling-order-and-nesting",
    nodes: [
      savedNode(113, { content: "Second root", props: {}, type: "paragraph" }),
      savedNode(
        112,
        { content: "Nested child", props: {}, type: "paragraph" },
        111,
      ),
      savedNode(111, {
        content: "First root",
        props: {},
        type: "bulletListItem",
      }),
    ],
  },
  {
    disposition: "preserve-raw",
    edges: [],
    name: "empty-object-default",
    nodes: [savedNode(120, {})],
  },
  {
    disposition: "preserve-raw",
    edges: [],
    name: "unknown-block",
    nodes: [
      savedNode(121, {
        content: "Do not discard this writing",
        props: {},
        type: "historicalUnknown",
      }),
    ],
  },
  {
    disposition: "preserve-raw",
    edges: [],
    name: "malformed-content",
    nodes: [
      savedNode(122, {
        content: { unexpected: "Keep original payload" },
        props: {},
        type: "paragraph",
      }),
    ],
  },
  {
    disposition: "preserve-raw",
    edges: [],
    name: "missing-parent",
    nodes: [
      savedNode(
        123,
        {
          content: "Unreachable child must remain recoverable",
          props: {},
          type: "paragraph",
        },
        999,
      ),
    ],
  },
  {
    disposition: "preserve-raw",
    edges: [savedEdge(124, 125), savedEdge(125, 124)],
    name: "sibling-cycle",
    nodes: [
      savedNode(124, { content: "Cycle A", props: {}, type: "paragraph" }),
      savedNode(125, { content: "Cycle B", props: {}, type: "paragraph" }),
    ],
  },
] as const;
