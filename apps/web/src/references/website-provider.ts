import { type DefaultTreeAdapterMap, parse } from "parse5";
import {
  publicWebDestination,
  readPublicHtml,
  safePublicWebUrl,
} from "./public-web-fetch";

export type WebsiteMetadata = {
  title?: string;
  excerpt?: string;
  imageUrl?: string;
};
export function parseWebsiteMetadata(
  html: string,
  url: string,
): WebsiteMetadata {
  const metadata = new Map<string, string>();
  let title = "";
  const text = (node: DefaultTreeAdapterMap["node"]): string =>
    "value" in node
      ? node.value
      : "childNodes" in node
        ? node.childNodes.map(text).join("")
        : "";
  const visit = (node: DefaultTreeAdapterMap["node"]) => {
    if ("tagName" in node) {
      if (node.tagName === "meta") {
        const attrs = new Map(
          node.attrs.map((attr) => [attr.name.toLowerCase(), attr.value]),
        );
        const key = (attrs.get("property") ?? attrs.get("name"))?.toLowerCase();
        const value = attrs.get("content");
        if (key && value && !metadata.has(key)) metadata.set(key, value);
      }
      if (node.tagName === "title" && !title) title = text(node);
      if (["script", "style", "template"].includes(node.tagName)) return;
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
  };
  visit(parse(html));
  const clean = (value: string | undefined, max: number) =>
    value?.replace(/\s+/g, " ").trim().slice(0, max) || undefined;
  const image = metadata.get("og:image") ?? metadata.get("twitter:image");
  return {
    excerpt: clean(
      metadata.get("og:description") ??
        metadata.get("twitter:description") ??
        metadata.get("description"),
      240,
    ),
    title: clean(
      metadata.get("og:title") ?? metadata.get("twitter:title") ?? title,
      180,
    ),
    ...(image && safePublicWebUrl(image, url)
      ? { imageUrl: safePublicWebUrl(image, url)?.href }
      : {}),
  };
}

const cache = new Map<
  string,
  { expiresAt: number; value: WebsiteMetadata | null }
>();
const pending = new Map<string, Promise<WebsiteMetadata | null>>();
const userMisses = new Map<string, number[]>();
let active = 0;
export async function getWebsiteMetadata(userId: string, value: string) {
  const url = safePublicWebUrl(value)?.href;
  if (!userId || !url) return null;
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const existing = pending.get(url);
  if (existing) return existing;
  const now = Date.now();
  const misses = (userMisses.get(userId) ?? []).filter(
    (time) => now - time < 60_000,
  );
  if (active >= 4 || misses.length >= 20) return null;
  userMisses.set(userId, [...misses, now]);
  active++;
  const request = (async () => {
    let result: WebsiteMetadata | null = null;
    try {
      const signal = AbortSignal.timeout(3_000);
      const response = await readPublicHtml(url, signal);
      result = parseWebsiteMetadata(response.html, response.url);
      if (result.imageUrl) {
        try {
          await publicWebDestination(result.imageUrl, signal);
        } catch {
          delete result.imageUrl;
        }
      }
      if (!result.title && !result.excerpt && !result.imageUrl) result = null;
    } catch {
      /* Missing or unsafe metadata retains the authored URL. */
    } finally {
      active--;
    }
    if (cache.size >= 1000) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(url, {
      expiresAt: Date.now() + (result ? 300_000 : 30_000),
      value: result,
    });
    return result;
  })();
  pending.set(url, request);
  try {
    return await request;
  } finally {
    pending.delete(url);
  }
}

export function resetWebsiteMetadataCacheForTests() {
  cache.clear();
  pending.clear();
  userMisses.clear();
  active = 0;
}
