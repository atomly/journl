import {
  inventoryDocumentId,
  inventoryId,
  inventoryReference,
  largeDocument,
  parityBlocks,
} from "@acme/blocknote/inventory";
import { ReadOnlyBlocks } from "@acme/blocknote/read-only";
import type {
  EditorPartialBlock,
  EditorPrimitive,
} from "@acme/blocknote/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { ThemeProvider } from "next-themes";
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Virtuoso } from "react-virtuoso";
import { BlockEditor } from "~/components/editor/block-editor";
import { useBlockEditor } from "~/components/editor/use-block-editor";
import { JournlAgentProvider } from "~/hooks/use-journl-agent";
import type { ApiRouter } from "~/trpc";
import { TRPCProvider } from "~/trpc/react";
import type { InventoryScenario, MountResult } from "./types";
import "~/app/styles.css";
import "~/app/(app)/styles.css";
import "./style.css";

const root = createRoot(document.getElementById("root") as HTMLElement);
let key = 0;
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
  },
});
const trpcClient = createTRPCClient<ApiRouter>({
  links: [
    () =>
      ({ op }) =>
        observable((observer) => {
          // Deterministic, local reference metadata. No HTTP, auth, AI or database is used.
          const data = op.path.endsWith("getPreviews")
            ? {
                items: [
                  {
                    preview: {
                      excerpt: "Local reference benchmark",
                      href: `/pages/${inventoryDocumentId}`,
                      kind: "page",
                      status: "ready",
                      title: "Synthetic reference",
                    },
                  },
                ],
              }
            : op.path.endsWith("getEmbedContent")
              ? {
                  items: [
                    {
                      blocks: [
                        {
                          content: [
                            {
                              text: "Read-only synthetic writing",
                              type: "text",
                            },
                          ],
                          id: inventoryId(900),
                          type: "paragraph",
                        },
                      ],
                      href: `/pages/${inventoryDocumentId}`,
                      status: "ready",
                      title: "Synthetic embed",
                    },
                  ],
                  nextCursor: null,
                }
              : { items: [], nextCursor: null };
          observer.next({ result: { data } });
          observer.complete();
        }),
  ],
});

function Editor({
  blocks,
}: {
  blocks: [EditorPartialBlock, ...EditorPartialBlock[]];
}) {
  const editor = useBlockEditor({ initialBlocks: blocks });
  const ref = useRef<EditorPrimitive>(editor);
  useEffect(() => {
    const dom = ref.current.prosemirrorView.dom;
    const input = () => {
      const start = performance.now();
      requestAnimationFrame(() =>
        window.editorInventory.samples.push(performance.now() - start),
      );
    };
    dom.addEventListener("beforeinput", input, true);
    return () => dom.removeEventListener("beforeinput", input, true);
  }, []);
  return (
    <BlockEditor
      editor={editor}
      debug={false}
      formattingToolbar={false}
      slashMenu={false}
      onChange={(transactions) => {
        window.editorInventory.transactions += transactions.length;
      }}
    />
  );
}

function Preview() {
  const editor = useBlockEditor({
    initialBlocks: [{ content: "", id: inventoryId(800), type: "paragraph" }],
  });
  const flatten = (
    blocks: EditorPartialBlock[],
    depth = 0,
  ): Parameters<typeof ReadOnlyBlocks>[0]["blocks"] =>
    blocks.flatMap((block) => [
      {
        content: block.content,
        depth,
        id: block.id,
        props: block.props,
        type: block.type ?? "paragraph",
      },
      ...flatten(block.children ?? [], depth + 1),
    ]);
  return (
    <div data-scroll>
      <BlockEditor
        editor={editor}
        editable={false}
        debug={false}
        formattingToolbar={false}
        slashMenu={false}
      >
        <ReadOnlyBlocks
          blocks={flatten(parityBlocks)}
          depth={0}
          ancestorKeys={new Set()}
        />
      </BlockEditor>
    </div>
  );
}

function Surface({ scenario }: { scenario: InventoryScenario }) {
  if (scenario.surface === "preview") return <Preview />;
  if (scenario.surface === "references") {
    const blocks = largeDocument(scenario.blocks).map(
      (block, index): EditorPartialBlock => {
        const props = {
          ...inventoryReference,
          documentId: inventoryId(1000000 + index),
          label: `Reference ${index + 1}`,
          url: `/pages/${inventoryId(1000000 + index)}`,
        };
        return index > 0 && index % 20 === 0
          ? { id: block.id, props, type: "referenceCard" }
          : {
              content: [
                {
                  styles: {},
                  text: `Reference passage ${index + 1} `,
                  type: "text",
                },
                { props, type: "contentReference" },
              ],
              id: block.id,
              type: "paragraph",
            };
      },
    );
    const [first, ...rest] = blocks;
    if (!first) return null;
    return (
      <div data-scroll>
        <Editor blocks={[first, ...rest]} />
      </div>
    );
  }
  if (scenario.surface === "page")
    return (
      <div data-scroll>
        <Editor blocks={largeDocument(scenario.blocks)} />
      </div>
    );
  const rows = scenario.surface === "entries" ? 100 : 365;
  return (
    <Virtuoso
      style={{ height: "100vh" }}
      data={Array.from({ length: rows }, (_, index) => index)}
      increaseViewportBy={200}
      itemContent={(_, index) => {
        const blocks = largeDocument(
          scenario.surface === "timeline" && index > 0 ? 1 : scenario.blocks,
        ).map((block, blockIndex) => ({
          ...block,
          id: inventoryId(100000 + index * 100 + blockIndex),
        }));
        const [first, ...rest] = blocks;
        if (!first) return null;
        return (
          <section className="inventory-row">
            <h2>Journal entry {index + 1}</h2>
            <Editor blocks={[first, ...rest]} />
          </section>
        );
      }}
    />
  );
}

window.editorInventory = {
  errors: [],
  async mount(scenario): Promise<MountResult> {
    await document.fonts.ready;
    queryClient.clear();
    window.editorInventory.samples = [];
    window.editorInventory.transactions = 0;
    const start = performance.now();
    flushSync(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            <ThemeProvider attribute="class" defaultTheme="light">
              <JournlAgentProvider>
                <Surface key={++key} scenario={scenario} />
              </JournlAgentProvider>
            </ThemeProvider>
          </TRPCProvider>
        </QueryClientProvider>,
      ),
    );
    const deadline = performance.now() + 10000;
    let lastCount = -1;
    let stableFrames = 0;
    while (stableFrames < 3) {
      await nextFrame();
      const count = document.querySelectorAll(
        scenario.surface === "preview"
          ? ".content-embed-body > div"
          : '.bn-editor[contenteditable="true"]',
      ).length;
      stableFrames = count > 0 && count === lastCount ? stableFrames + 1 : 0;
      lastCount = count;
      if (performance.now() > deadline)
        throw new Error("Editor did not mount and stabilize");
    }
    return {
      documentBlocks: scenario.blocks,
      editors: document.querySelectorAll('.bn-editor[contenteditable="true"]')
        .length,
      milliseconds: performance.now() - start,
      renderedBlocks: document.querySelectorAll(".bn-block-outer").length,
    };
  },
  samples: [],
  transactions: 0,
};
window.addEventListener("error", (event) =>
  window.editorInventory.errors.push(event.message),
);
