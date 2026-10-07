/**
 * Small WebCrypto helpers shared by the worker and the route handlers.
 * Everything here runs on the Cloudflare Workers runtime.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64Url(bytes: Uint8Array<ArrayBufferLike> | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function base64UrlEncodeString(value: string): string {
  return bytesToBase64Url(encoder.encode(value));
}

export function base64UrlDecodeString(value: string): string {
  return decoder.decode(base64UrlToBytes(value));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += (bytes[i] + 0x100).toString(16).slice(1);
  return hex;
}

export function randomHex(byteLength: number): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function randomBase64Url(byteLength: number): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** HMAC-SHA256 signature encoded as base64url (no padding). */
export async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bytesToBase64Url(signature);
}

/** Constant-time HMAC verification. */
export async function verifyHmac(secret: string, message: string, signature: string): Promise<boolean> {
  if (!secret || !signature) return false;
  let received: Uint8Array;
  try {
    received = base64UrlToBytes(signature);
  } catch {
    return false;
  }
  const key = await hmacKey(secret);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  if (expected.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ received[i];
  return diff === 0;
}

/** Constant-time string comparison for credentials. */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const key = await hmacKey("cf-visitas::compare::sentinel");
  const [left, right] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b)),
  ]);
  const aBytes = new Uint8Array(left);
  const bBytes = new Uint8Array(right);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

export function isHex(value: unknown, length?: number): value is string {
  return typeof value === "string" && (length === undefined || value.length === length) && /^[0-9a-f]+$/i.test(value);
}
