import { PreviewStatus } from "@acme/references/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

test("missing internal targets never promise an available source", () => {
  const html = renderToStaticMarkup(
    <PreviewStatus unavailable targetUnavailable />,
  );
  expect(html).toContain("Referenced content is unavailable");
  expect(html).not.toContain("You can still open the source");
  expect(html).toContain('role="status"');
});

test("failed external metadata retains its usable source fallback", () => {
  expect(renderToStaticMarkup(<PreviewStatus unavailable />)).toContain(
    "You can still open the source",
  );
});
