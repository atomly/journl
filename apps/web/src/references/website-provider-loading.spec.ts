import { expect, test, vi } from "vitest";
import { createPreviewPipeline } from "./preview-pipeline";
import { websiteProvider } from "./website-provider";

vi.mock("open-graph-scraper", () => {
  throw new Error("Extractor module could not be loaded");
});
vi.mock("./public-web-fetch", async (original) => ({
  ...(await original<typeof import("./public-web-fetch")>()),
  readPublicHtml: async () => ({
    html: "<title>Page</title>",
    url: "https://example.com/article",
  }),
}));

test("extractor loading failure stays inside enrichment and leaves a usable link", async () => {
  const pipeline = createPreviewPipeline([websiteProvider]);
  expect(
    await pipeline.resolve("https://example.com/article#section", {
      ownerId: "owner",
    }),
  ).toMatchObject({
    enrichment: "failed",
    href: "https://example.com/article#section",
    metadataState: "url-only",
    status: "ready",
  });
});
