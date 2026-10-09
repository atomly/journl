import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  getGithubMetadata,
  resetGithubMetadataCacheForTests,
} from "../src/references/github-provider";

beforeEach(() => {
  resetGithubMetadataCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public GitHub metadata provider", () => {
  test("uses a fixed GitHub API host and extracts public issue metadata", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            body: "A useful description",
            pull_request: {},
            state: "open",
            title: "Add reference graph",
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const metadata = await getGithubMetadata(
      "user-1",
      "https://github.com/atomly/journl/pull/291",
    );
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "https://api.github.com/repos/atomly/journl/issues/291",
      expect.objectContaining({ redirect: "error" }),
    );
    expect(metadata).toEqual({
      excerpt: "A useful description",
      status: "open pull request",
      title: "Add reference graph",
    });
  });

  test("rejects spoofed hosts and falls back on unavailable metadata", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await getGithubMetadata(
        "user-1",
        "https://github.com.evil.example/atomly/journl",
      ),
    ).toBeNull();
    expect(
      await getGithubMetadata(
        "user-1",
        "https://github.com/atomly/journl/issues/291?tab=comments",
      ),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(
      await getGithubMetadata(
        "user-1",
        "https://github.com/atomly/journl/issues/291",
      ),
    ).toBeNull();
  });

  test("coalesces duplicate metadata requests", async () => {
    let resolveResponse!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn(() => response);
    vi.stubGlobal("fetch", fetchMock);

    const a = getGithubMetadata("user-1", "https://github.com/atomly/journl");
    const b = getGithubMetadata(
      "user-1",
      "https://github.com/atomly/journl#readme",
    );
    resolveResponse(
      new Response(JSON.stringify({ description: "A repo", name: "journl" }), {
        status: 200,
      }),
    );
    const [one, two] = await Promise.all([a, b]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(one).toEqual(two);
  });

  test("limits unique cache misses per user while allowing a different user", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    for (let number = 1; number <= 21; number += 1) {
      await getGithubMetadata(
        "user-1",
        `https://github.com/atomly/journl/issues/${number}`,
      );
    }
    await getGithubMetadata("user-2", "https://github.com/atomly/journl");

    expect(fetchMock).toHaveBeenCalledTimes(21);
  });
});
