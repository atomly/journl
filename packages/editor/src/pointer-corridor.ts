type Rect = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

/** A bounded bridge between a block and the toolbar above it. No overlay steals
 * text clicks, and no timer leaves a stale handle on a different row. */
export function inToolbarCorridor(
  x: number,
  y: number,
  block: Rect,
  toolbar: Rect,
): boolean {
  const gap = block.top - toolbar.bottom;
  if (gap < 0 || gap > 48 || y < toolbar.bottom - 4 || y > block.top + 4)
    return false;
  const progress = gap
    ? Math.max(0, Math.min(1, (y - toolbar.bottom) / gap))
    : 1;
  const left = toolbar.left + (block.left - toolbar.left) * progress;
  const right = toolbar.right + (block.right - toolbar.right) * progress;
  return x >= left - 4 && x <= right + 4;
}
