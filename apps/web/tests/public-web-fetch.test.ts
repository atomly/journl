import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, expect, test, vi } from "vitest";
import {
  isPublicWebAddress,
  publicWebDestination,
  readPublicHtml,
  safePublicWebUrl,
} from "../src/references/public-web-fetch";

const network = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: network.lookup }));
vi.mock("node:http", () => ({ request: network.request }));
vi.mock("node:https", () => ({ request: network.request }));
beforeEach(() => {
  network.lookup.mockReset();
  network.request.mockReset();
  network.lookup.mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
});

test("rejects private, mapped, reserved, and encoded IP addresses", () => {
  for (const address of [
    "127.0.0.1",
    "169.254.169.254",
    "10.0.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
    "2002:7f00:1::1",
  ])
    expect(isPublicWebAddress(address), address).toBe(false);
  expect(isPublicWebAddress("1.1.1.1")).toBe(true);
  expect(isPublicWebAddress("2606:4700:4700::1111")).toBe(true);
  for (const url of [
    "http://2130706433/",
    "http://0x7f000001/",
    "http://localhost/",
    "http://a.local/",
    "https://user:pass@example.com/",
    "https://example.com:8443/",
    "file:///tmp/file",
  ])
    expect(safePublicWebUrl(url), url).toBeNull();
});

test("rejects a hostname with any private DNS answer before making a request", async () => {
  network.lookup.mockResolvedValue([
    { address: "1.1.1.1", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ]);
  await expect(
    readPublicHtml("https://example.com", new AbortController().signal),
  ).rejects.toThrow("Not a public destination");
  expect(network.request).not.toHaveBeenCalled();
});

function response(status: number, headers: Record<string, string>, body = "") {
  network.request.mockImplementationOnce((_url, _options, receive) => {
    const request = new EventEmitter() as EventEmitter & { end: () => void };
    request.end = () => {
      const stream = Object.assign(new PassThrough(), {
        headers,
        statusCode: status,
      });
      receive(stream);
      queueMicrotask(() => {
        if (!stream.destroyed) stream.end(body);
      });
    };
    return request;
  });
}

test("pins a public DNS answer into the actual request lookup", async () => {
  response(200, { "content-type": "text/html" }, "<title>Useful page</title>");
  expect(
    await readPublicHtml("https://example.com", new AbortController().signal),
  ).toMatchObject({ html: "<title>Useful page</title>" });
  const options = network.request.mock.calls[0]?.[1];
  const callback = vi.fn();
  options.lookup("example.com", { all: true }, callback);
  expect(callback).toHaveBeenCalledWith(null, [
    { address: "1.1.1.1", family: 4 },
  ]);
  expect(network.lookup).toHaveBeenCalledTimes(1);
});

test("revalidates redirects and never follows a redirect into a private network", async () => {
  response(302, { location: "http://169.254.169.254/latest/meta-data" });
  await expect(
    readPublicHtml("https://example.com", new AbortController().signal),
  ).rejects.toThrow("Not a public HTTP URL");
  expect(network.request).toHaveBeenCalledTimes(1);
});

test("rejects non-HTML and oversized responses", async () => {
  response(200, { "content-type": "application/json" }, "{}");
  await expect(
    readPublicHtml("https://example.com", new AbortController().signal),
  ).rejects.toThrow("No bounded HTML preview");
  response(200, { "content-type": "text/html" }, "a".repeat(256 * 1024 + 1));
  await expect(
    readPublicHtml("https://example.com", new AbortController().signal),
  ).rejects.toThrow("Preview response too large");
});

test("deadline aborts a stalled DNS lookup", async () => {
  network.lookup.mockImplementation(() => new Promise(() => {}));
  const controller = new AbortController();
  const result = publicWebDestination("https://example.com", controller.signal);
  controller.abort(new Error("Deadline"));
  await expect(result).rejects.toThrow("Deadline");
});

test("reads a bounded head from a large page without downloading its body", async () => {
  const head = "<head><title>Large public page</title></head>";
  response(
    200,
    { "content-length": "2000000", "content-type": "text/html" },
    head + "a".repeat(300_000),
  );
  expect(
    await readPublicHtml("https://example.com", new AbortController().signal),
  ).toMatchObject({ html: head });
});
