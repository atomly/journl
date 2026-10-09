import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  getWebsiteMetadata,
  parseWebsiteMetadata,
  resetWebsiteMetadataCacheForTests,
} from "../src/references/website-provider";

const network = vi.hoisted(() => ({ destination: vi.fn(), html: vi.fn() }));
vi.mock("../src/references/public-web-fetch", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../src/references/public-web-fetch")
  >()),
  publicWebDestination: network.destination,
  readPublicHtml: network.html,
}));
beforeEach(() => {
  resetWebsiteMetadataCacheForTests();
  network.html.mockReset();
  network.destination.mockReset();
  network.destination.mockResolvedValue({});
});
afterEach(() => vi.restoreAllMocks());

test("reads Open Graph metadata and decodes HTML entities without executing content", () => {
  expect(
    parseWebsiteMetadata(
      `<title>Fallback</title><meta content="A &amp; B" property="og:title"><meta name="description" content="Useful &quot;details&quot;"><meta property="og:image" content="/thumbnail.png"><script>fake = '<meta property="og:title" content="Script">'</script>`,
      "https://example.com/article",
    ),
  ).toEqual({
    excerpt: 'Useful "details"',
    imageUrl: "https://example.com/thumbnail.png",
    title: "A & B",
  });
  expect(
    parseWebsiteMetadata(
      '<title> Plain title </title><meta name="twitter:description" content="Summary"><meta property="og:image" content="http://127.0.0.1/private">',
      "https://example.com",
    ),
  ).toEqual({ excerpt: "Summary", title: "Plain title" });
});

test("coalesces and caches metadata, validates image destinations", async () => {
  network.html.mockResolvedValue({
    html: '<title>Example article</title><meta property="og:image" content="https://images.example.com/a.png">',
    url: "https://example.com/article",
  });
  const [a, b] = await Promise.all([
    getWebsiteMetadata("user", "https://example.com/article"),
    getWebsiteMetadata("user", "https://example.com/article"),
  ]);
  expect(a).toEqual(b);
  expect(a?.title).toBe("Example article");
  expect(network.html).toHaveBeenCalledTimes(1);
  expect(network.destination).toHaveBeenCalledWith(
    "https://images.example.com/a.png",
    expect.any(AbortSignal),
  );
  await getWebsiteMetadata("user", "https://example.com/article");
  expect(network.html).toHaveBeenCalledTimes(1);
});

test("unsafe or failed metadata falls back without fetching private URLs", async () => {
  expect(await getWebsiteMetadata("user", "http://127.0.0.1/admin")).toBeNull();
  expect(network.html).not.toHaveBeenCalled();
  network.html.mockRejectedValue(new Error("Timed out"));
  expect(await getWebsiteMetadata("user", "https://example.com")).toBeNull();
  expect(await getWebsiteMetadata("user", "https://example.com")).toBeNull();
  expect(network.html).toHaveBeenCalledTimes(1);
});

test("discards a private image but retains useful title and description", async () => {
  network.html.mockResolvedValue({
    html: '<title>Public article</title><meta name="description" content="Summary"><meta property="og:image" content="https://images.example.com/image.png">',
    url: "https://example.com",
  });
  network.destination.mockRejectedValue(new Error("Not a public destination"));
  expect(await getWebsiteMetadata("user", "https://example.com")).toEqual({
    excerpt: "Summary",
    title: "Public article",
  });
});
