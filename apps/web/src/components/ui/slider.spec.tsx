// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Slider } from "~/components/ui/slider";

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
  vi.unstubAllGlobals();
});

test.each<{
  label: string;
  props: ComponentProps<typeof Slider>;
  values: number[];
}>([
  { label: "scalar controlled value", props: { value: 25 }, values: [25] },
  { label: "scalar default value", props: { defaultValue: 0 }, values: [0] },
  { label: "default minimum", props: { min: 10 }, values: [10] },
  { label: "controlled range", props: { value: [20, 80] }, values: [20, 80] },
  {
    label: "default range",
    props: { defaultValue: [20, 50, 80] },
    values: [20, 50, 80],
  },
])(
  "Slider renders the correct thumbs for $label",
  async ({ props, values }) => {
    await act(async () => root.render(<Slider {...props} />));
    const sliders = Array.from(container.querySelectorAll("input[type=range]"));
    expect(
      sliders.map((slider) => Number(slider.getAttribute("aria-valuenow"))),
    ).toEqual(values);
  },
);

test("a scalar slider responds to keyboard changes", async () => {
  const onValueChange = vi.fn();
  await act(async () =>
    root.render(<Slider defaultValue={25} onValueChange={onValueChange} />),
  );
  const thumb = container.querySelector<HTMLElement>("input[type=range]");
  await act(async () => {
    thumb?.focus();
    thumb?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }),
    );
  });
  expect(onValueChange).toHaveBeenCalledWith(26, expect.any(Object));
  expect(thumb?.getAttribute("aria-valuenow")).toBe("26");
});
