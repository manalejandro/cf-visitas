/**
 * Absolute origin of the current request (for example `https://example.com`).
 *
 * Used for canonical URLs, Open Graph metadata and the tracker snippet so the
 * project never hardcodes a deployment domain.
 */

import { headers } from "next/headers";

export async function getSiteOrigin(): Promise<string> {
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
    if (!host) return "";

    const forwardedProto = requestHeaders.get("x-forwarded-proto");
    const isLocal =
      host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("[::1]") || host.endsWith(".local");
    const protocol = forwardedProto ?? (isLocal ? "http" : "https");

    return `${protocol}://${host}`;
  } catch {
    return "";
  }
}
