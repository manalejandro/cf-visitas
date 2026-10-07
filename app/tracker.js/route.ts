import { buildTrackerScript } from "@/lib/tracker";

export const dynamic = "force-dynamic";

/**
 * GET /tracker.js
 *
 * Serves a per-request tracker script. The response is generated dynamically
 * because it embeds:
 *   - the RSA public key used to encrypt visit payloads,
 *   - the current blocklist (SHA-256 fingerprints) so blocked browsers can be
 *     stopped before the page renders,
 *   - a signed config (HMAC-SHA256) that the API verifies on every beacon.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    // Prefer the Host header: Wrangler rewrites `request.url` to the configured
    // custom-domain route during local development, while the header keeps the
    // real origin the browser used.
    const url = new URL(request.url);
    const host = request.headers.get("host") ?? url.host;
    const script = await buildTrackerScript(`${url.protocol}//${host}`);
    return new Response(script, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[visitas] tracker generation error:", error);
    return new Response("/* tracker temporarily unavailable */", {
      status: 500,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
