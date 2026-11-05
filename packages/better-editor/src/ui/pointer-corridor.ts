type Rect = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

/** Protect the toolbar's edges and the short bridge to its block. This is
 * geometry, not a timer or overlay: entering another row releases the handle. */
export function inToolbarCorridor(
  x: number,
  y: number,
  block: Rect,
  toolbar: Rect,
): boolean {
  const padding = 8;
  if (
    x >= toolbar.left - padding &&
    x <= toolbar.right + padding &&
    y >= toolbar.top - padding &&
    y <= toolbar.bottom + padding
  )
    return true;
  const gap = block.top - toolbar.bottom;
  if (gap < 0 || gap > 64) return false;
  return (
    y >= toolbar.bottom - padding &&
    y <= block.top + padding &&
    x >= Math.min(toolbar.left, block.left) - padding &&
    x <= Math.max(toolbar.right, block.right) + padding
  );
}
