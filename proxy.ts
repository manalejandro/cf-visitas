import { NextResponse, type NextRequest } from "next/server";

/**
 * Adds a nonce-based Content-Security-Policy to every HTML page.
 * API routes and static assets are excluded via the matcher below.
 */
export default function proxy(request: NextRequest): NextResponse {
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));

  const directives = [
    "default-src 'self'",
    isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  const contentSecurityPolicy = directives.join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: ["/((?!api/|tracker\\.js|_next/|.*\\..*).*)"],
};
