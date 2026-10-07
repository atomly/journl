import { normalizeExternalUrl } from "./reference-utils";

const MAX_RESPONSE_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 3_000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const ERROR_CACHE_TTL_MS = 30 * 1000;
const MAX_IN_FLIGHT = 4;
const MAX_MISSES_PER_USER_PER_MINUTE = 20;
const USER_LIMIT_WINDOW_MS = 60 * 1000;

export type GithubMetadata = {
  title: string;
  excerpt: string;
  status?: string;
};

type CacheItem = { value: GithubMetadata | null; expiresAt: number };
const cache = new Map<string, CacheItem>();
const pending = new Map<string, Promise<GithubMetadata | null>>();
const userMisses = new Map<string, number[]>();
let activeRequests = 0;

function parsePublicGithubUrl(value: string) {
  const normalized = normalizeExternalUrl(value);
  if (!normalized) return null;
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return null;
  }
  if (url.hostname.toLowerCase() !== "github.com" || url.port || url.search)
    return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return null;
  if (parts.some((part) => !/^[a-zA-Z0-9_.-]+$/.test(part))) return null;
  const [owner, repo, section, id] = parts;
  if (!owner || !repo) return null;
  if (parts.length === 2) {
    return { apiPath: `/repos/${owner}/${repo}`, fallback: `${owner}/${repo}` };
  }
  if (
    parts.length === 4 &&
    ["issues", "pull"].includes(section ?? "") &&
    /^\d+$/.test(id ?? "")
  ) {
    return {
      apiPath: `/repos/${owner}/${repo}/issues/${id}`,
      fallback: `${owner}/${repo} #${id}`,
    };
  }
  return null;
}

async function readBounded(response: Response) {
  const advertised = Number(response.headers.get("content-length"));
  if (Number.isFinite(advertised) && advertised > MAX_RESPONSE_BYTES) {
    throw new Error("GitHub response too large");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("GitHub response too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchMetadata(
  apiPath: string,
  fallbackTitle: string,
): Promise<GithubMetadata | null> {
  if (activeRequests >= MAX_IN_FLIGHT) return null;
  activeRequests += 1;
  try {
    const response = await fetch(`https://api.github.com${apiPath}`, {
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Journl content reference preview",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const json = JSON.parse(await readBounded(response)) as {
      title?: unknown;
      full_name?: unknown;
      description?: unknown;
      body?: unknown;
      name?: unknown;
      state?: unknown;
      pull_request?: unknown;
      html_url?: unknown;
    };
    const title =
      typeof json.title === "string"
        ? json.title
        : typeof json.full_name === "string"
          ? json.full_name
          : fallbackTitle;
    const body =
      typeof json.body === "string"
        ? json.body
        : typeof json.description === "string"
          ? json.description
          : "";
    const excerpt = body.replace(/\s+/g, " ").trim().slice(0, 240);
    const status =
      typeof json.state === "string"
        ? json.state === "open" && json.pull_request
          ? "open pull request"
          : json.state
        : undefined;
    return title
      ? {
          excerpt,
          title: title.slice(0, 180),
          ...(status ? { status } : {}),
        }
      : null;
  } catch {
    return null;
  } finally {
    activeRequests -= 1;
  }
}

export async function getGithubMetadata(userId: string, url: string) {
  if (!userId) return null;
  const normalized = normalizeExternalUrl(url);
  const target = normalized ? parsePublicGithubUrl(normalized) : null;
  if (!normalized || !target) return null;
  const cached = cache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const active = pending.get(normalized);
  if (active) return active;
  const now = Date.now();
  const recentMisses = (userMisses.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < USER_LIMIT_WINDOW_MS,
  );
  if (recentMisses.length >= MAX_MISSES_PER_USER_PER_MINUTE) {
    userMisses.set(userId, recentMisses);
    return null;
  }
  recentMisses.push(now);
  userMisses.set(userId, recentMisses);

  const request = fetchMetadata(target.apiPath, target.fallback).then(
    (value) => {
      cache.set(normalized, {
        expiresAt: Date.now() + (value ? CACHE_TTL_MS : ERROR_CACHE_TTL_MS),
        value,
      });
      return value;
    },
  );
  pending.set(normalized, request);
  try {
    return await request;
  } finally {
    pending.delete(normalized);
  }
}

export function resetGithubMetadataCacheForTests() {
  cache.clear();
  pending.clear();
  userMisses.clear();
  activeRequests = 0;
}
