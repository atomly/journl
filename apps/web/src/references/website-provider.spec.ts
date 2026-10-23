import { beforeEach, expect, test, vi } from "vitest";
import { extractWebsiteMetadata, websiteProvider } from "./website-provider";

const network = vi.hoisted(() => ({ destination: vi.fn(), html: vi.fn() }));
vi.mock("./public-web-fetch", async (original) => ({
  ...(await original<typeof import("./public-web-fetch")>()),
  publicWebDestination: network.destination,
  readPublicHtml: network.html,
}));
beforeEach(() => {
  network.html.mockReset();
  network.destination.mockReset();
  network.destination.mockResolvedValue({});
});
test("extracts standard metadata and entities without executing scripts", async () => {
  expect(
    await extractWebsiteMetadata(
      `<title>Fallback</title><meta content="A &amp; B" property="og:title"><meta name="description" content="Useful &quot;details&quot;"><meta property="og:image" content="/thumbnail.png"><script>throw new Error('execute')</script>`,
      "https://example.com/article",
    ),
  ).toEqual({
    excerpt: "Useful “details”",
    imageUrl: "https://example.com/thumbnail.png",
    title: "A & B",
  });
});
test("reads body JSON-LD and ignores malformed JSON-LD", async () => {
  expect(
    await extractWebsiteMetadata(
      '<html><head></head><body><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Structured article","description":"Body details"}</script></body></html>',
      "https://example.com",
    ),
  ).toMatchObject({ excerpt: "Body details", title: "Structured article" });
  expect(
    await extractWebsiteMetadata(
      '<title>Fallback</title><script type="application/ld+json">{bad json</script>',
      "https://example.com",
    ),
  ).toMatchObject({ title: "Fallback" });
});
test("discards unsafe images and rechecks public image DNS", async () => {
  expect(
    await extractWebsiteMetadata(
      '<title>Public</title><meta property="og:image" content="http://127.0.0.1/private">',
      "https://example.com",
    ),
  ).toEqual({ title: "Public" });
  network.html.mockResolvedValue({
    html: '<title>Public</title><meta property="og:image" content="https://images.example.com/a.png">',
    url: "https://example.com",
  });
  network.destination.mockRejectedValue(new Error("Private destination"));
  expect(
    await websiteProvider.resolve(
      new URL("https://example.com"),
      { ownerId: "a" },
      new AbortController().signal,
    ),
  ).toEqual({ title: "Public" });
  expect(network.destination).toHaveBeenCalledWith(
    "https://images.example.com/a.png",
    expect.any(AbortSignal),
  );
});
