/**
 * Hybrid decryption of tracker payloads:
 *   RSA-OAEP(SHA-256) unwraps a one-time AES-256-GCM key, then AES-GCM decrypts
 *   the JSON payload. The tracker uses the same scheme with WebCrypto.
 */

import { base64UrlToBytes } from "./crypto";
import { getPrivateKeyForKid } from "./keys";

export interface EncryptedPayload {
  key: string;
  iv: string;
  data: string;
}

const MAX_KEY_BYTES = 1024;
const MAX_IV_BYTES = 32;
const MAX_DATA_BYTES = 256 * 1024;

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.key === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.data === "string" &&
    candidate.key.length <= 2048 &&
    candidate.iv.length <= 128 &&
    candidate.data.length <= 512 * 1024
  );
}

export async function decryptTrackerPayload(encrypted: EncryptedPayload, kid: number): Promise<unknown> {
  const wrappedKey = base64UrlToBytes(encrypted.key);
  const iv = base64UrlToBytes(encrypted.iv);
  const data = base64UrlToBytes(encrypted.data);

  if (wrappedKey.byteLength > MAX_KEY_BYTES || iv.byteLength > MAX_IV_BYTES || data.byteLength > MAX_DATA_BYTES) {
    throw new Error("Encrypted payload exceeds size limits");
  }

  const privateKey = await getPrivateKeyForKid(kid);
  if (!privateKey) throw new Error(`Tracker key ${kid} is not available`);
  const rawKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, wrappedKey);
  const aesKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, data);
  return JSON.parse(new TextDecoder().decode(plaintext));
}
