// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ExploreCanvas } from "../src/app/(app)/graph/_components/explore-canvas";
import type { ExploreCamera } from "../src/app/(app)/graph/_components/explore-flow";
import type { ExploreGraph } from "../src/references/explore-graph";
import { mockFlowDom } from "./explore-flow-test-dom";

const graph: ExploreGraph = {
  edges: [
    {
      fromKey: "root",
      occurrenceCount: 1,
      occurrenceIds: ["passage"],
      presentations: ["link"],
      sourceBlocks: ["passage"],
      sources: [
        {
          blockId: "passage",
          excerpt: "Authored evidence",
          href: "/pages/root#block=passage",
        },
      ],
      toKey: "neighbor",
    },
  ],
  nodes: ["root", "neighbor"].map((key) => ({
    key,
    kind: "page",
    target: { documentId: key, kind: "document" },
    title: key,
  })),
};
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let camera: ExploreCamera;
const select = vi.fn();
function TestMap() {
  const [viewport, setViewport] = useState(camera);
  const [selected, setSelected] = useState<string>();
  const [selectedEdge, setSelectedEdge] = useState<string>();
  return (
    <ExploreCanvas
      graph={graph}
      width={900}
      focusKey="root"
      selectedKey={selected}
      selectedEdgeKey={selectedEdge}
      camera={viewport}
      onCamera={(next) => {
        camera = next;
        setViewport(next);
      }}
      onSelect={(node, edge) => {
        select(node, edge);
        setSelected(node.key);
        setSelectedEdge(edge ? `${edge.fromKey}|${edge.toKey}` : undefined);
      }}
      onDeselect={() => {
        setSelected(undefined);
        setSelectedEdge(undefined);
      }}
    />
  );
}
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mockFlowDom();
  camera = undefined;
  select.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<TestMap />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("React Flow keyboard selection opens notes and authored edge context", async () => {
  const node = container.querySelector('[aria-label="Preview neighbor"]');
  await act(async () =>
    node?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    ),
  );
  expect(select).toHaveBeenLastCalledWith(graph.nodes[1], undefined);
  await settle();
  const edge = container.querySelector(".react-flow__edge");
  expect(edge).not.toBeNull();
  await act(async () =>
    edge?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: " " }),
    ),
  );
  expect(select).toHaveBeenLastCalledWith(graph.nodes[1], graph.edges[0]);
  expect(
    container
      .querySelector('[aria-label="Preview neighbor"]')
      ?.classList.contains("selected"),
  ).toBe(true);
  await act(async () =>
    container
      .querySelector(".react-flow__edge")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      ),
  );
  expect(
    container
      .querySelector('[aria-label="Preview neighbor"]')
      ?.classList.contains("selected"),
  ).toBe(false);
});

test("library zoom controls persist the viewport and restore it after remount", async () => {
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')
      ?.click(),
  );
  await settle();
  expect(camera?.zoom).toBeGreaterThan(1);
  const saved = camera;
  await act(async () => root.render(<TestMap key="restored" />));
  expect(
    container.querySelector(".react-flow__viewport")?.getAttribute("style"),
  ).toContain(`scale(${saved?.zoom})`);
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="Fit map"]')
      ?.click(),
  );
  await settle();
  expect(camera?.zoom).toBeGreaterThan(0);
  expect(select).not.toHaveBeenCalled();
});

test("each click opens context once, including reselecting a note after its edge", async () => {
  await settle();
  const node = container.querySelector<HTMLElement>(
    '[aria-label="Preview neighbor"]',
  );
  await act(async () => node?.click());
  expect(select).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenLastCalledWith(graph.nodes[1], undefined);
  await act(async () =>
    container
      .querySelector(".react-flow__edge")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  expect(select).toHaveBeenCalledTimes(2);
  expect(select).toHaveBeenLastCalledWith(graph.nodes[1], graph.edges[0]);
  await act(async () =>
    container
      .querySelector(".react-flow__edge")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  expect(select).toHaveBeenCalledTimes(3);
  await act(async () => node?.click());
  expect(select).toHaveBeenCalledTimes(4);
  expect(select).toHaveBeenLastCalledWith(graph.nodes[1], undefined);
});
