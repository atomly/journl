import { githubSource } from "@acme/references";
import type { PreviewProvider } from "./preview-pipeline";
import { readPublicJson } from "./public-web-fetch";
import { websiteProvider } from "./website-provider";

export const githubProvider: PreviewProvider = {
  cacheScope: "public",
  async resolve(url, context, signal) {
    const parts = url.pathname.split("/").filter(Boolean);
    const apiPath =
      parts.length === 2
        ? `/repos/${parts[0]}/${parts[1]}`
        : `/repos/${parts[0]}/${parts[1]}/issues/${parts[3]}`;
    try {
      const data = await readPublicJson(
        `https://api.github.com${apiPath}`,
        signal,
      );
      if (!data || typeof data !== "object")
        throw new Error("Invalid GitHub metadata");
      const json = data as Record<string, unknown>;
      const title =
        typeof json.title === "string"
          ? json.title
          : typeof json.full_name === "string"
            ? json.full_name
            : undefined;
      const excerpt =
        typeof json.body === "string"
          ? json.body
          : typeof json.description === "string"
            ? json.description
            : undefined;
      if (!title) throw new Error("Missing GitHub metadata");
      return {
        excerpt,
        title,
        ...(typeof json.state === "string"
          ? {
              sourceStatus:
                json.state === "open" && json.pull_request
                  ? "open pull request"
                  : json.state,
            }
          : {}),
      };
    } catch {
      // A public HTML fallback is useful if the API rate limit is exhausted.
      // Do not fetch the page on every successful API response.
      signal.throwIfAborted();
      return websiteProvider.resolve(url, context, signal);
    }
  },
  source: githubSource,
};
