// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { useExploreState } from "../src/app/(app)/explore/_components/explore-state";
import { ExploreStateProvider } from "../src/app/(app)/explore/_components/explore-state-provider";

test("account changes never restore another owner's cursors, search or navigation", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  sessionStorage.clear();
  const container = document.createElement("div");
  const root = createRoot(container);
  function Probe() {
    const [state, setState] = useExploreState("overview", {
      cursor: undefined as string | undefined,
      search: "",
    });
    return (
      <>
        <output>{JSON.stringify(state)}</output>
        <button
          type="button"
          onClick={() =>
            setState({ cursor: "owner-a-cursor", search: "Private project" })
          }
        >
          Save
        </button>
      </>
    );
  }
  const render = (owner: string) =>
    act(async () =>
      root.render(
        <ExploreStateProvider owner={owner}>
          <Probe />
        </ExploreStateProvider>,
      ),
    );
  try {
    await render("a");
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toContain("Private project");
    await render("b");
    expect(container.querySelector("output")?.textContent).toBe(
      '{"search":""}',
    );
    await render("a");
    expect(container.textContent).toContain("owner-a-cursor");
    expect(sessionStorage.getItem("journl:explore:b:overview")).not.toContain(
      "Private project",
    );
  } finally {
    await act(async () => root.unmount());
    sessionStorage.clear();
  }
});
