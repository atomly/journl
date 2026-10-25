import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
    excerpt: 'Useful "details"',
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

test("keeps Twitter and JSON-LD graph fallbacks and resolves relative images", async () => {
  expect(
    await extractWebsiteMetadata(
      '<meta name="twitter:title" content="Twitter title"><meta name="twitter:description" content="Twitter description"><meta name="twitter:image" content="../image.png">',
      "https://example.com/article/entry",
    ),
  ).toEqual({
    excerpt: "Twitter description",
    imageUrl: "https://example.com/image.png",
    title: "Twitter title",
  });
  expect(
    await extractWebsiteMetadata(
      '<script type="application/ld+json">{"@graph":[{"@type":"Article","headline":"Graph article","description":"Graph details","image":{"url":"/graph.png"}}]}</script>',
      "https://example.com",
    ),
  ).toEqual({
    excerpt: "Graph details",
    imageUrl: "https://example.com/graph.png",
    title: "Graph article",
  });
});

test("Open Graph metadata wins over competing HTML, Twitter and JSON-LD values", async () => {
  expect(
    await extractWebsiteMetadata(
      '<title>HTML title</title><meta property="og:title" content="OG title"><meta property="og:description" content="OG details"><meta property="og:image" content="/og.png"><meta name="twitter:title" content="Twitter title"><script type="application/ld+json">{"headline":"Structured title","description":"Structured details"}</script>',
      "https://example.com",
    ),
  ).toEqual({
    excerpt: "OG details",
    imageUrl: "https://example.com/og.png",
    title: "OG title",
  });
});

test("empty or metadata-free HTML returns no enrichment", async () => {
  expect(await extractWebsiteMetadata("", "https://example.com")).toBeNull();
  expect(
    await extractWebsiteMetadata(
      "<html><body></body></html>",
      "https://example.com",
    ),
  ).toBeNull();
});

test("the installed extractor works with Node require(esm) disabled, without Vite transformation", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--no-experimental-require-module",
      "-e",
      `
    const extract = require('open-graph-scraper');
    extract({ html: '<title>Runtime check</title>' })
      .then(({ result }) => process.stdout.write(JSON.stringify({ title: result.ogTitle })))
      .catch(error => { console.error(error); process.exitCode = 1; });
  `,
    ],
    {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      encoding: "utf8",
      timeout: 10000,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ title: "Runtime check" });
});
