// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import {
  ExploreCanvas,
  INITIAL_CAMERA,
} from "../src/app/(app)/graph/_components/explore-canvas";
import type {
  ExploreGraph,
  ExploreNode,
} from "../src/references/explore-graph";

const note = (key: string): ExploreNode => ({
  key,
  kind: "page",
  target: { documentId: key, kind: "document" },
  title: `Note ${key}`,
});
const targets = Array.from(
  { length: 15 },
  (_, index): ExploreNode =>
    index % 2
      ? {
          href: `https://example.com/${index}`,
          key: `source:${index}`,
          kind: "external",
          target: { kind: "external", url: `https://example.com/${index}` },
          title: `Source ${index}`,
        }
      : note(`note:${index}`),
);
const graph: ExploreGraph = {
  edges: targets.map((node, index) => ({
    fromKey: "root",
    occurrenceCount: 1,
    occurrenceIds: [`${index}`],
    presentations: ["link"],
    sourceBlocks: [],
    sources: [],
    toKey: node.key,
  })),
  nodes: [note("root"), note("other"), ...targets],
};

for (const width of [340, 900])
  test(`See all reveals every note and source beyond the ${width < 640 ? 6 : 8}-node canvas cap and resets on scope change`, async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    const select = vi.fn();
    const render = async (focusKey: string) => {
      await act(async () =>
        root.render(
          <ExploreCanvas
            graph={graph}
            width={width}
            focusKey={focusKey}
            camera={INITIAL_CAMERA}
            onCamera={() => {}}
            onSelect={select}
            onExplore={() => {}}
          />,
        ),
      );
    };
    try {
      await render("root");
      expect(
        element.querySelectorAll("svg [aria-label^='Preview ']"),
      ).toHaveLength(width < 640 ? 7 : 9);
      const toggle = Array.from(element.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("See all connections (15)"),
      );
      expect(toggle).toBeDefined();
      expect(
        element.querySelector("[aria-label='All connections']"),
      ).toBeNull();
      await act(async () => toggle?.click());
      const list = element.querySelector("[aria-label='All connections']");
      expect(list?.querySelectorAll("li")).toHaveLength(15);
      expect(list?.textContent).toContain("Source 13");
      expect(list?.textContent).toContain("Note note:14");
      expect(select).not.toHaveBeenCalled();
      const external = list?.querySelector<HTMLButtonElement>(
        "[aria-label='Read Source 13']",
      );
      await act(async () => external?.click());
      expect(select).toHaveBeenCalledWith(targets[13], graph.edges[13]);
      await render("other");
      expect(
        element.querySelector("[aria-label='All connections']"),
      ).toBeNull();
      await render("root");
      expect(
        element.querySelector("[aria-label='All connections']"),
      ).toBeNull();
    } finally {
      await act(async () => root.unmount());
      element.remove();
      vi.unstubAllGlobals();
    }
  });
