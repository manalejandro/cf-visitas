/**
 * Decryption of tracker payloads.
 *
 * Two envelope shapes are accepted:
 *
 *   - Post-quantum (current): `{ kem, iv, data }`
 *       ML-KEM-1024 ciphertext (FIPS 203) → HKDF-SHA256 → AES-256-GCM.
 *   - Legacy: `{ key, iv, data }`
 *       RSA-OAEP(SHA-256)-wrapped AES-256-GCM key. Kept so trackers served
 *       before the post-quantum switch keep working during the grace period.
 */

import { base64UrlToBytes } from "./crypto";
import { getKeyMaterialForKid } from "./keys";
import { decapsulate, deriveAesKey, LEGACY_ALGORITHM, PQ_ALGORITHM } from "./pq";

export interface PqEncryptedPayload {
  kem: string;
  iv: string;
  data: string;
}

export interface LegacyEncryptedPayload {
  key: string;
  iv: string;
  data: string;
}

export type EncryptedPayload = PqEncryptedPayload | LegacyEncryptedPayload;

const MAX_KEM_BYTES = 2048;
const MAX_KEY_BYTES = 1024;
const MAX_IV_BYTES = 32;
const MAX_DATA_BYTES = 256 * 1024;

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const hasIv = typeof candidate.iv === "string" && candidate.iv.length <= 128;
  const hasData = typeof candidate.data === "string" && candidate.data.length <= 512 * 1024;
  const hasKem = typeof candidate.kem === "string" && candidate.kem.length <= 4096;
  const hasKey = typeof candidate.key === "string" && candidate.key.length <= 2048;
  return hasIv && hasData && (hasKem || hasKey);
}

export async function decryptTrackerPayload(encrypted: EncryptedPayload, kid: number): Promise<unknown> {
  const key = await getKeyMaterialForKid(kid);
  if (!key) throw new Error(`Tracker key ${kid} is not available`);

  const iv = base64UrlToBytes(encrypted.iv);
  const data = base64UrlToBytes(encrypted.data);
  if (iv.byteLength > MAX_IV_BYTES || data.byteLength > MAX_DATA_BYTES) {
    throw new Error("Encrypted payload exceeds size limits");
  }

  if ("kem" in encrypted) {
    if (key.algorithm !== PQ_ALGORITHM) throw new Error(`Tracker key ${kid} is not a ${PQ_ALGORITHM} key`);
    const kemBytes = base64UrlToBytes(encrypted.kem);
    if (kemBytes.byteLength > MAX_KEM_BYTES) throw new Error("KEM ciphertext exceeds size limits");

    const sharedSecret = decapsulate(encrypted.kem, key.privateKey);
    const aesKey = await deriveAesKey(sharedSecret, "decrypt");
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, data);
    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  // Legacy RSA-OAEP envelope.
  if (key.algorithm !== LEGACY_ALGORITHM) throw new Error(`Tracker key ${kid} is not a ${LEGACY_ALGORITHM} key`);
  const wrappedKey = base64UrlToBytes(encrypted.key);
  if (wrappedKey.byteLength > MAX_KEY_BYTES) throw new Error("Wrapped key exceeds size limits");

  const privateKey = await importLegacyRsaKey(kid, key.privateKey);
  const rawKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, wrappedKey);
  const aesKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, data);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

const legacyKeyCache = new Map<number, Promise<CryptoKey>>();

function importLegacyRsaKey(kid: number, privateKeyJwk: string): Promise<CryptoKey> {
  const cached = legacyKeyCache.get(kid);
  if (cached) return cached;

  const promise = crypto.subtle.importKey(
    "jwk",
    JSON.parse(privateKeyJwk) as JsonWebKey,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
  legacyKeyCache.set(kid, promise);
  promise.catch(() => legacyKeyCache.delete(kid));
  return promise;
}
