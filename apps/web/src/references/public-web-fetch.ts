import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blockedV4.addSubnet(address, prefix, "ipv4");
const publicV6 = new BlockList();
publicV6.addSubnet("2000::", 3, "ipv6");
const blockedV6 = new BlockList();
for (const [address, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  blockedV6.addSubnet(address, prefix, "ipv6");

export function isPublicWebAddress(address: string) {
  const family = isIP(address);
  return family === 4
    ? !blockedV4.check(address, "ipv4")
    : family === 6 &&
        publicV6.check(address, "ipv6") &&
        !blockedV6.check(address, "ipv6");
}

export function safePublicWebUrl(value: string, base?: string) {
  try {
    const url = new URL(value, base);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      !hostname ||
      hostname === "localhost" ||
      /\.(localhost|local|internal|test|invalid)$/i.test(hostname) ||
      (isIP(hostname) ? !isPublicWebAddress(hostname) : !hostname.includes("."))
    )
      return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export async function publicWebDestination(value: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const url = safePublicWebUrl(value);
  if (!url) throw new Error("Not a public HTTP URL");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await new Promise<LookupAddress[]>((resolve, reject) => {
        const aborted = () => reject(signal.reason);
        signal.addEventListener("abort", aborted, { once: true });
        void lookup(hostname, { all: true, verbatim: true })
          .then(resolve, reject)
          .finally(() => signal.removeEventListener("abort", aborted));
      });
  signal.throwIfAborted();
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicWebAddress(address))
  )
    throw new Error("Not a public destination");
  return { addresses, url };
}

const MAX_BYTES = 256 * 1024;
export async function readPublicHtml(value: string, signal: AbortSignal) {
  let current = value;
  for (let redirects = 0; redirects <= 2; redirects++) {
    const { url, addresses } = await publicWebDestination(current, signal);
    const result = await new Promise<{ html?: string; redirect?: string }>(
      (resolve, reject) => {
        const request = (
          url.protocol === "https:" ? httpsRequest : httpRequest
        )(
          url,
          {
            agent: false,
            headers: {
              Accept: "text/html,application/xhtml+xml",
              "Accept-Encoding": "identity",
              "User-Agent": "Journl link preview",
            },
            // Pin the validated DNS result so DNS cannot change between validation
            // and connection. Every redirect is validated independently.
            lookup: (_hostname, options, callback) => {
              if (options.all) callback(null, addresses);
              else
                callback(
                  null,
                  addresses[0]?.address ?? "",
                  addresses[0]?.family ?? 4,
                );
            },
            signal,
          },
          (response) => {
            const status = response.statusCode ?? 0;
            if (
              [301, 302, 303, 307, 308].includes(status) &&
              response.headers.location
            ) {
              response.destroy();
              try {
                resolve({
                  redirect: new URL(response.headers.location, url).href,
                });
              } catch (error) {
                reject(error);
              }
              return;
            }
            if (
              status < 200 ||
              status >= 300 ||
              !/^text\/html\b|^application\/xhtml\+xml\b/i.test(
                response.headers["content-type"] ?? "",
              )
            ) {
              response.destroy();
              reject(new Error("No bounded HTML preview"));
              return;
            }
            const chunks: Buffer[] = [];
            let bytes = 0;
            response.on("data", (chunk: Buffer) => {
              const remaining = MAX_BYTES - bytes;
              chunks.push(chunk.subarray(0, remaining));
              bytes += chunk.length;
              const html = Buffer.concat(chunks).toString("utf8");
              const headEnd = /<\/head\s*>/i.exec(html);
              if (headEnd?.index !== undefined) {
                response.destroy();
                resolve({
                  html: html.slice(0, headEnd.index + headEnd[0].length),
                });
              } else if (bytes > MAX_BYTES) {
                response.destroy(new Error("Preview response too large"));
              }
            });
            response.on("error", reject);
            response.on("end", () =>
              resolve({ html: Buffer.concat(chunks).toString("utf8") }),
            );
          },
        );
        request.on("error", reject);
        request.end();
      },
    );
    if (result.html !== undefined) return { html: result.html, url: url.href };
    if (!result.redirect) throw new Error("No preview response");
    current = result.redirect;
  }
  throw new Error("Too many preview redirects");
}
