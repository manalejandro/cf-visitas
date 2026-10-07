/**
 * Tracker signature.
 *
 * The generated `/tracker.js` embeds a config signed with `TRACKER_SIGNING_KEY`
 * (HMAC-SHA256). This signature is independent from the asymmetric encryption
 * of the visit payload: it proves to the API that the client used a tracker
 * issued by this worker, and it binds both the served blocklist and the key id
 * used for encryption to that config.
 *
 * Signed payload format: `v1.<kid>.<issuedAt>.<expiresAt>.<blocklistHash>`
 */

import { env } from "cloudflare:workers";
import { hmacSha256, sha256Hex, verifyHmac } from "./crypto";

export const TRACKER_VERSION = 1;
export const TRACKER_TTL_SECONDS = 24 * 60 * 60;

export interface TrackerSignature {
  issuedAt: number;
  expiresAt: number;
  blocklistHash: string;
  signature: string;
}

export function signaturePayload(kid: number, issuedAt: number, expiresAt: number, blocklistHash: string): string {
  return `v${TRACKER_VERSION}.${kid}.${issuedAt}.${expiresAt}.${blocklistHash}`;
}

export async function signTrackerConfig(kid: number, blockedHashes: string[]): Promise<TrackerSignature> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + TRACKER_TTL_SECONDS;
  const blocklistHash = await sha256Hex(JSON.stringify(blockedHashes));
  const secret = env.TRACKER_SIGNING_KEY;
  if (!secret) throw new Error("TRACKER_SIGNING_KEY is not configured");
  const signature = await hmacSha256(secret, signaturePayload(kid, issuedAt, expiresAt, blocklistHash));
  return { issuedAt, expiresAt, blocklistHash, signature };
}

export async function verifyTrackerRequest(input: {
  kid?: unknown;
  signature?: unknown;
  issuedAt?: unknown;
  expiresAt?: unknown;
  blocklistHash?: unknown;
}): Promise<boolean> {
  const { kid, signature, issuedAt, expiresAt, blocklistHash } = input;
  if (typeof signature !== "string" || signature.length > 512) return false;
  if (!Number.isInteger(kid) || (kid as number) <= 0) return false;
  if (typeof blocklistHash !== "string" || !/^[0-9a-f]{64}$/i.test(blocklistHash)) return false;
  if (!Number.isInteger(issuedAt) || !Number.isInteger(expiresAt)) return false;

  const issued = issuedAt as number;
  const expires = expiresAt as number;
  const now = Math.floor(Date.now() / 1000);

  if (expires < now) return false;
  if (issued > now + 300) return false; // future-dated configs are rejected
  if (expires - issued > TRACKER_TTL_SECONDS + 300) return false;

  const secret = env.TRACKER_SIGNING_KEY;
  if (!secret) return false;
  return verifyHmac(secret, signaturePayload(kid as number, issued, expires, blocklistHash), signature);
}
