import { beforeEach, expect, test, vi } from "vitest";
import { githubProvider } from "./github-provider";
import { createPreviewPipeline } from "./preview-pipeline";
import { websiteProvider } from "./website-provider";

const network = vi.hoisted(() => ({ html: vi.fn(), json: vi.fn() }));
vi.mock("./public-web-fetch", async (original) => ({
  ...(await original<typeof import("./public-web-fetch")>()),
  readPublicHtml: network.html,
  readPublicJson: network.json,
}));
beforeEach(() => {
  network.json.mockReset();
  network.html.mockReset();
});
test.each([
  [
    "atomly/journl",
    "/repos/atomly/journl",
    { description: "Repository", full_name: "atomly/journl" },
    "atomly/journl",
    "repository",
  ],
  [
    "atomly/journl/issues/1",
    "/repos/atomly/journl/issues/1",
    { body: "Details", state: "closed", title: "Issue" },
    "Issue",
    "issue",
  ],
  [
    "atomly/journl/pull/2",
    "/repos/atomly/journl/issues/2",
    { body: "Details", pull_request: {}, state: "open", title: "Pull request" },
    "Pull request",
    "pull-request",
  ],
])(
  "preserves GitHub metadata and classification for %s",
  async (path, api, json, title, icon) => {
    network.json.mockResolvedValue(json);
    const pipeline = createPreviewPipeline([githubProvider, websiteProvider]);
    expect(
      await pipeline.resolve(`https://github.com/${path}`, { ownerId: "a" }),
    ).toMatchObject({
      icon,
      metadataState: "enriched",
      sourceLabel: "GitHub",
      title,
    });
    expect(network.json).toHaveBeenCalledWith(
      `https://api.github.com${api}`,
      expect.any(AbortSignal),
    );
    expect(network.html).not.toHaveBeenCalled();
  },
);
test("API failure falls back to public website metadata", async () => {
  network.json.mockRejectedValue(new Error("rate limited"));
  network.html.mockResolvedValue({
    html: "<title>Public GitHub page</title>",
    url: "https://github.com/atomly/journl",
  });
  const pipeline = createPreviewPipeline([githubProvider, websiteProvider]);
  expect(
    await pipeline.resolve("https://github.com/atomly/journl", {
      ownerId: "a",
    }),
  ).toMatchObject({ provider: "github", title: "Public GitHub page" });
});
test("spoofed hosts and unsupported GitHub URLs do not call the API", async () => {
  network.html.mockRejectedValue(new Error("offline"));
  const pipeline = createPreviewPipeline([githubProvider, websiteProvider]);
  for (const url of [
    "https://github.com.evil.example/owner/repo",
    "https://github.com/owner/repo/issues/1?tab=comments",
  ])
    expect(await pipeline.resolve(url, { ownerId: "a" })).toMatchObject({
      metadataState: "url-only",
      provider: "website",
    });
  expect(network.json).not.toHaveBeenCalled();
});
