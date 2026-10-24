import { expect, test } from "vitest";
import { inToolbarCorridor } from "./pointer-corridor";

const block = { bottom: 240, left: 120, right: 760, top: 208 };
const toolbar = { bottom: 200, left: 200, right: 600, top: 160 };

test("the gap keeps the handle anchored while crossing towards or away from its toolbar", () => {
  expect(inToolbarCorridor(300, 204, block, toolbar)).toBe(true);
  expect(inToolbarCorridor(300, 200, block, toolbar)).toBe(true);
  expect(inToolbarCorridor(300, 208, block, toolbar)).toBe(true);
});

test("the corridor releases immediately on a different row or outside the connecting edges", () => {
  expect(inToolbarCorridor(300, 220, block, toolbar)).toBe(false);
  expect(inToolbarCorridor(300, 180, block, toolbar)).toBe(false);
  expect(inToolbarCorridor(100, 204, block, toolbar)).toBe(false);
  expect(inToolbarCorridor(800, 204, block, toolbar)).toBe(false);
});

test("a distant or overlapping toolbar cannot lock unrelated blocks", () => {
  expect(inToolbarCorridor(300, 204, { ...block, top: 300 }, toolbar)).toBe(
    false,
  );
  expect(inToolbarCorridor(300, 204, { ...block, top: 180 }, toolbar)).toBe(
    false,
  );
});
