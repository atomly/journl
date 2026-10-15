// @vitest-environment jsdom
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { TRPCReactProvider } from "./react";

vi.mock("~/env", () => ({ env: { NODE_ENV: "test" } }));

test("navigation keeps the owner's cache; account changes discard private cached Library rows", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(document.createElement("div"));
  let current!: QueryClient;
  function ReadCache() {
    current = useQueryClient();
    return null;
  }
  const render = async (owner: string) => {
    await act(() =>
      root.render(
        <TRPCReactProvider owner={owner}>
          <ReadCache />
        </TRPCReactProvider>,
      ),
    );
  };
  try {
    await render("alice");
    const alice = current;
    current.setQueryData(["tree", "children"], ["alice-private-folder"]);
    await render("alice");
    expect(current).toBe(alice);
    await render("bob");
    expect(current).not.toBe(alice);
    expect(current.getQueryData(["tree", "children"])).toBeUndefined();
    await render("alice");
    expect(current.getQueryData(["tree", "children"])).toBeUndefined();
  } finally {
    await act(() => root.unmount());
    current.clear();
    vi.unstubAllGlobals();
  }
});
