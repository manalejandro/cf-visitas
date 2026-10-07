import { NextResponse, type NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions, verifyCredentials } from "@/lib/auth";
import { getClientIp } from "@/lib/geo";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST /api/login — verifies admin credentials and issues a session cookie. */
export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request) || "unknown";
  if (!rateLimit("login", ip, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const valid = await verifyCredentials(username, password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionToken(username);
  const response = NextResponse.json({ ok: true, user: { username } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}

/** DELETE /api/login — clears the session cookie. */
export async function DELETE(): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
