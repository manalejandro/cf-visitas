/**
 * Admin authentication: signed session cookies (HS256 JWT) + credentials that
 * live in Worker secrets (`ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`).
 */

import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  base64UrlDecodeString,
  base64UrlEncodeString,
  hmacSha256,
  timingSafeEqual,
  verifyHmac,
} from "./crypto";

export const SESSION_COOKIE = "visitas_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

function sessionSecret(): string {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured. Run `npm run keys:generate` and set the secret.");
  return secret;
}

export async function createSessionToken(username: string): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub: username, iat: issuedAt, exp: issuedAt + SESSION_TTL_SECONDS };
  const header = base64UrlEncodeString(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncodeString(JSON.stringify(payload));
  const signature = await hmacSha256(sessionSecret(), `${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  try {
    const valid = await verifyHmac(sessionSecret(), `${header}.${body}`, signature);
    if (!valid) return null;
    const payload = JSON.parse(base64UrlDecodeString(body)) as SessionPayload;
    if (!payload?.sub || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Session for server components / server actions (reads the request cookie). */
export async function getSessionUser(): Promise<SessionPayload | null> {
  try {
    const store = await cookies();
    return await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

/** Session for route handlers (cookie or `Authorization: Bearer`). */
export async function getSessionUserFromRequest(request: NextRequest): Promise<SessionPayload | null> {
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value;
  const fromCookie = await verifySessionToken(cookieValue);
  if (fromCookie) return fromCookie;

  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return verifySessionToken(authorization.slice(7).trim());
  }
  return null;
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const expectedUser = env.ADMIN_USER ?? "";
  const expectedPassword = env.ADMIN_PASSWORD ?? "";
  if (!expectedUser || !expectedPassword) return false;
  const [userOk, passwordOk] = await Promise.all([
    timingSafeEqual(username, expectedUser),
    timingSafeEqual(password, expectedPassword),
  ]);
  return userOk && passwordOk;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
