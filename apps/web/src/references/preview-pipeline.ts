import {
  describeExternal,
  type ExternalDescription,
  type PreviewSource,
  type ReferencePreviewData,
} from "@acme/references";
import { LRUCache } from "lru-cache";
import pLimit from "p-limit";
import { safePublicWebUrl } from "./public-web-fetch";

export type PreviewContext = {
  ownerId: string;
  /** Opaque identifiers only. Credentials remain server-side, never in keys/results. */
  connection?: { id: string; revision: string };
};
export type PreviewMetadata = {
  title?: string;
  excerpt?: string;
  imageUrl?: string;
  sourceStatus?: string;
};
export type PreviewProvider = {
  source: PreviewSource;
  /** Public sharing must be explicit; future authenticated providers default to isolation. */
  cacheScope?: "public";
  resolve(
    url: URL,
    context: PreviewContext,
    signal: AbortSignal,
  ): Promise<PreviewMetadata | null>;
};
const clean = (text: string | undefined, max: number) =>
  text?.replace(/\s+/g, " ").trim().slice(0, max) || undefined;

/** One process-local pipeline. These bounds are resource controls, not billing quotas. */
export function createPreviewPipeline(
  providers: readonly PreviewProvider[],
  options: {
    maxCache?: number;
    concurrency?: number;
    maxPending?: number;
    missesPerMinute?: number;
  } = {},
) {
  const cache = new LRUCache<string, ReferencePreviewData>({
    max: options.maxCache ?? 1000,
  });
  const misses = new LRUCache<string, number>({ max: 1000, ttl: 60_000 });
  const pending = new Map<string, Promise<ReferencePreviewData>>();
  const limit = pLimit(options.concurrency ?? 4);
  const sources = providers.map((provider) => provider.source);
  function fallback(
    url: URL,
    description: ExternalDescription,
  ): ReferencePreviewData {
    return {
      excerpt: description.excerpt,
      icon: description.icon,
      provider: description.provider,
      sourceLabel: description.sourceLabel,
      title: description.title,
      ...(description.compactLabel
        ? { compactLabel: description.compactLabel }
        : {}),
      href: url.href,
      kind: "external",
      metadataState: "url-only",
      status: "ready",
      truncated: false,
    };
  }
  return {
    async resolve(
      value: string,
      context: PreviewContext,
    ): Promise<ReferencePreviewData> {
      const url = safePublicWebUrl(value);
      const description = url && describeExternal(url.href, sources);
      if (!url || !description || !context.ownerId)
        return { status: "unavailable" };
      // Metadata is shared across fragments; navigation always uses the authored URL.
      const present = (result: ReferencePreviewData): ReferencePreviewData => ({
        ...result,
        href: new URL(value).href,
      });
      const provider = providers.find(
        (item) => item.source.id === description.provider,
      );
      if (!provider) return { status: "unavailable" };
      const base = fallback(url, description);
      const scope =
        provider.cacheScope === "public"
          ? ["public"]
          : [
              "owner",
              context.ownerId,
              context.connection?.id ?? null,
              context.connection?.revision ?? null,
            ];
      const key = JSON.stringify([provider.source.id, scope, url.href]);
      const cached = cache.get(key);
      if (cached) return present(cached);
      const existing = pending.get(key);
      if (existing) return present(await existing);
      const count = misses.get(context.ownerId) ?? 0;
      if (
        pending.size >= (options.maxPending ?? 50) ||
        count >= (options.missesPerMinute ?? 20)
      )
        return present({ ...base, enrichment: "busy" });
      misses.set(context.ownerId, count + 1, {
        ttl:
          misses.getRemainingTTL(context.ownerId) > 0
            ? misses.getRemainingTTL(context.ownerId)
            : 60_000,
      });
      const request = limit(async () => {
        let metadata: PreviewMetadata | null = null;
        let enrichment: ReferencePreviewData["enrichment"] = "missing";
        try {
          metadata = await provider.resolve(
            url,
            context,
            AbortSignal.timeout(3000),
          );
          enrichment = metadata ? "ready" : "missing";
        } catch {
          enrichment = "failed";
        }
        const result: ReferencePreviewData = {
          ...base,
          enrichment,
          metadataState: metadata ? "enriched" : "url-only",
          ...(clean(metadata?.title, 180)
            ? { title: clean(metadata?.title, 180) }
            : {}),
          ...(clean(metadata?.excerpt, 240)
            ? { excerpt: clean(metadata?.excerpt, 240) }
            : {}),
          ...(metadata?.imageUrl ? { imageUrl: metadata.imageUrl } : {}),
          ...(clean(metadata?.sourceStatus, 80)
            ? { sourceStatus: clean(metadata?.sourceStatus, 80) }
            : {}),
        };
        cache.set(key, result, { ttl: metadata ? 300_000 : 30_000 });
        return result;
      });
      pending.set(key, request);
      try {
        return present(await request);
      } finally {
        pending.delete(key);
      }
    },
  };
}
