import { websiteSource } from "@acme/references";
import type { PreviewMetadata, PreviewProvider } from "./preview-pipeline";
import {
  publicWebDestination,
  readPublicHtml,
  safePublicWebUrl,
} from "./public-web-fetch";

const text = (value: unknown) =>
  typeof value === "string"
    ? value.replace(/\s+/g, " ").trim() || undefined
    : undefined;
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
function linkedData(values: unknown[]): Record<string, unknown>[] {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .flatMap((value) =>
      record(value)
        ? [value, ...(Array.isArray(value["@graph"]) ? value["@graph"] : [])]
        : [],
    )
    .filter(record);
}
function linkedImage(value: unknown): string | undefined {
  for (const image of Array.isArray(value) ? value : [value]) {
    const url =
      text(image) ||
      (record(image) ? text(image.url) || text(image.contentUrl) : undefined);
    if (url) return url;
  }
}

export async function extractWebsiteMetadata(
  html: string,
  url: string,
): Promise<PreviewMetadata | null> {
  if (!html.trim()) return null;
  // Keep optional extraction out of route initialization. Supply only HTML so
  // all network access stays behind our bounded, DNS-pinned public-web fetcher.
  const { default: extract } = await import("open-graph-scraper");
  const { result } = await extract({
    html,
    jsonLDOptions: { throwOnJSONParseError: false },
  });
  const structured = linkedData(result.jsonLD ?? []);
  const title =
    text(result.ogTitle) ||
    text(result.twitterTitle) ||
    structured
      .map((item) => text(item.headline) || text(item.name))
      .find(Boolean);
  const excerpt =
    text(result.ogDescription) ||
    text(result.twitterDescription) ||
    structured
      .map((item) => text(item.articleBody) || text(item.description))
      .find(Boolean);
  const image =
    result.ogImage?.[0]?.url ||
    result.twitterImage?.[0]?.url ||
    structured.map((item) => linkedImage(item.image)).find(Boolean);
  const imageUrl = image ? safePublicWebUrl(image, url)?.href : undefined;
  return title || excerpt || imageUrl
    ? {
        ...(title ? { title } : {}),
        ...(excerpt ? { excerpt } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      }
    : null;
}

export const websiteProvider: PreviewProvider = {
  cacheScope: "public",
  async resolve(url, _context, signal) {
    const response = await readPublicHtml(url.href, signal);
    const metadata = await extractWebsiteMetadata(response.html, response.url);
    if (metadata?.imageUrl) {
      try {
        await publicWebDestination(metadata.imageUrl, signal);
      } catch {
        delete metadata.imageUrl;
      }
    }
    return metadata;
  },
  source: websiteSource,
};
