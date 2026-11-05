// @vitest-environment jsdom
import {
  PreviewIcon,
  PreviewImage,
  PreviewStatus,
} from "@acme/references/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

test("composed previews keep accessible status and a usable link when thumbnails fail", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (
    loading: boolean,
    unavailable: boolean,
    src = "https://example.com/image.png",
  ) => (
    <article>
      <PreviewIcon icon="future-platform-icon" />
      <PreviewImage src={src} />
      <a href="https://example.com/article">Open source</a>
      <PreviewStatus loading={loading} unavailable={unavailable}>
        Summary
      </PreviewStatus>
    </article>
  );
  try {
    await act(async () => root.render(render(true, false)));
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Loading preview…",
    );
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    await act(async () =>
      container.querySelector("img")?.dispatchEvent(new Event("error")),
    );
    expect(container.querySelector("img")).toBeNull();
    await act(async () => root.render(render(false, true)));
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "You can still open the source",
    );
    expect(container.querySelector("a")?.href).toBe(
      "https://example.com/article",
    );
    await act(async () =>
      root.render(render(false, false, "https://example.com/other.png")),
    );
    expect(container.querySelector("img")?.getAttribute("referrerpolicy")).toBe(
      "no-referrer",
    );
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Summary",
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
