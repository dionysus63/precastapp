/**
 * UUID v4 that works in non-secure contexts. `crypto.randomUUID` exists only
 * on HTTPS/localhost, and the office serves over plain LAN HTTP — calling it
 * there throws and takes the whole page down. `crypto.getRandomValues` is
 * available everywhere, so fall back to assembling the UUID manually.
 */
export function randomId(): string {
  const cryptoObj = globalThis.crypto;
  if (typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }

  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
