/**
 * Post-quantum cryptography helpers.
 *
 * Visit payloads use hybrid post-quantum encryption:
 *   ML-KEM-1024 (NIST FIPS 203, "Kyber", security category 5) encapsulates a
 *   shared secret that is stretched with HKDF-SHA256 into an AES-256-GCM key
 *   used to encrypt the payload.
 *
 * WebCrypto does not expose ML-KEM yet, so both the Worker and the tracker use
 * the audited `@noble/post-quantum` implementation.
 */

import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import { base64UrlToBytes, bytesToBase64Url } from "./crypto";

export const PQ_ALGORITHM = "ML-KEM-1024";
export const LEGACY_ALGORITHM = "RSA-OAEP-256";

/** HKDF domain separation for the AES key derived from the KEM secret. */
export const KEM_HKDF_INFO = "visitas/ml-kem-1024/aes-256-gcm/v1";

export interface PqKeyPair {
  /** base64url of the raw ML-KEM-1024 encapsulation key (1568 bytes). */
  publicKey: string;
  /** base64url of the raw ML-KEM-1024 decapsulation key (3168 bytes). */
  privateKey: string;
}

export function generatePqKeyPair(): PqKeyPair {
  const { publicKey, secretKey } = ml_kem1024.keygen();
  return {
    publicKey: bytesToBase64Url(publicKey),
    privateKey: bytesToBase64Url(secretKey),
  };
}

export function decapsulate(cipherTextBase64Url: string, privateKeyBase64Url: string): Uint8Array<ArrayBuffer> {
  const sharedSecret = ml_kem1024.decapsulate(
    base64UrlToBytes(cipherTextBase64Url),
    base64UrlToBytes(privateKeyBase64Url),
  );
  // Copy into a fresh ArrayBuffer-backed view for WebCrypto.
  return new Uint8Array(sharedSecret);
}

/** HKDF-SHA256(sharedSecret) → AES-256-GCM key (encrypt or decrypt). */
export async function deriveAesKey(sharedSecret: Uint8Array<ArrayBuffer>, usage: KeyUsage): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(KEM_HKDF_INFO),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}
