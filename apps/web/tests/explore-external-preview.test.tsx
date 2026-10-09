// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { ExplorePreview } from "../src/app/(app)/graph/_components/explore-preview";

const mock = vi.hoisted(() => ({ fail: false, targets: [] as unknown[] }));
vi.mock("next/link", () => ({
  default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
}));
vi.mock("../src/trpc/react", () => ({
  useTRPC: () => ({
    references: {
      getPreviews: {
        queryOptions: (input: { targets: unknown[] }, options: object) => ({
          queryFn: async () => {
            mock.targets = input.targets;
            if (mock.fail) throw new Error("Metadata unavailable");
            return {
              items: [
                {
                  preview: {
                    excerpt: "Review #302 and its implementation notes.",
                    provider: "github",
                    status: "ready",
                    title: "Improve embedded content",
                  },
                },
              ],
            };
          },
          queryKey: ["preview", input],
          ...options,
        }),
      },
    },
  }),
}));

for (const fail of [false, true])
  test(`external source preview ${fail ? "retains the destination when metadata fails" : "loads metadata and incoming authored passages"}`, async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mock.fail = fail;
    mock.targets = [];
    const node = {
      href: "https://github.com/atomly/journl/pull/302",
      key: "external",
      kind: "external" as const,
      target: {
        kind: "external" as const,
        url: "https://github.com/atomly/journl/pull/302",
      },
      title: "atomly/journl · PR #302",
    };
    const source = {
      key: "note",
      kind: "page" as const,
      target: { documentId: "note", kind: "document" as const },
      title: "Review feedback",
    };
    const graph = {
      edges: [
        {
          fromKey: "note",
          occurrenceCount: 1,
          occurrenceIds: ["1"],
          presentations: ["link"],
          sourceBlocks: ["block"],
          sources: [
            {
              blockId: "block",
              excerpt: "Follow this implementation review",
              href: "/pages/note#block=block",
            },
          ],
          toKey: "external",
        },
      ],
      nodes: [source, node],
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={client}>
            <ExplorePreview
              node={node}
              graph={graph}
              onSelect={() => {}}
              onExplore={() => {}}
              onOpen={() => {}}
            />
          </QueryClientProvider>,
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(mock.targets).toEqual([node.target]);
      expect(element.textContent).toContain(
        fail ? "Preview could not load" : "Improve embedded content",
      );
      expect(element.textContent).toContain(
        "Follow this implementation review",
      );
      const destination = Array.from(element.querySelectorAll("a")).find(
        (anchor) => anchor.textContent?.includes("Open source"),
      );
      expect(destination?.href).toBe(node.href);
      expect(destination?.target).toBe("_blank");
      expect(destination?.rel).toBe("noopener noreferrer");
    } finally {
      await act(async () => root.unmount());
      client.clear();
      element.remove();
      vi.unstubAllGlobals();
    }
  });
