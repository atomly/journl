import { websiteSource } from "@acme/references";
import metascraper from "metascraper";
import description from "metascraper-description";
import image from "metascraper-image";
import title from "metascraper-title";
import type { PreviewMetadata, PreviewProvider } from "./preview-pipeline";
import {
  publicWebDestination,
  readPublicHtml,
  safePublicWebUrl,
} from "./public-web-fetch";

// Supplied HTML only: no browser, script execution, oEmbed requests, or hosted API.
const extract = metascraper([title(), description(), image()]);
export async function extractWebsiteMetadata(
  html: string,
  url: string,
): Promise<PreviewMetadata | null> {
  const data = await extract({ html, url });
  const imageUrl = data.image
    ? safePublicWebUrl(data.image, url)?.href
    : undefined;
  return data.title || data.description || imageUrl
    ? {
        ...(data.title ? { title: data.title } : {}),
        ...(data.description ? { excerpt: data.description } : {}),
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
