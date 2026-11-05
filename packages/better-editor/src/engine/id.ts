/**
 * Create a UUID v4 for client-side blocks, copied content, and optimistic edits.
 * Uses Web Crypto bytes so HTTP LAN origins work without `crypto.randomUUID`.
 * This environment-neutral helper also works on servers with Web Crypto; it
 * contains no server credentials or privileged operations.
 */
export function createEditorId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
