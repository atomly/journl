// @vitest-environment jsdom

import Link from "next/link";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Button } from "~/components/ui/button";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test.each(["anchor", "Next Link"])(
  "Button asChild supports %s without native button warnings",
  async (kind) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onClick = vi.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    );
    await act(async () => {
      root.render(
        <Button asChild>
          {kind === "anchor" ? (
            <a href="/journal" onClick={onClick}>
              Journal
            </a>
          ) : (
            <Link href="/journal" onClick={onClick}>
              Journal
            </Link>
          )}
        </Button>,
      );
    });
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/journal");
    await act(async () => link?.click());
    expect(onClick).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
  },
);

test("disabled asChild links expose their disabled state and prevent activation", async () => {
  const onClick = vi.fn();
  await act(async () => {
    root.render(
      <Button asChild disabled onClick={onClick}>
        <a href="/journal">Journal</a>
      </Button>,
    );
  });
  const link = container.querySelector("a");
  expect(link?.getAttribute("aria-disabled")).toBe("true");
  await act(async () => link?.click());
  expect(onClick).not.toHaveBeenCalled();
});

test("asChild native buttons retain form submission semantics", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const onSubmit = vi.fn((event: { preventDefault: () => void }) =>
    event.preventDefault(),
  );
  await act(async () => {
    root.render(
      <form onSubmit={onSubmit}>
        <Button asChild>
          <button type="submit">Save</button>
        </Button>
      </form>,
    );
  });
  await act(async () => container.querySelector("button")?.click());
  expect(onSubmit).toHaveBeenCalledOnce();
  expect(error).not.toHaveBeenCalled();
});
