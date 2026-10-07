#!/usr/bin/env node
/**
 * Generates the Worker secrets required by cf-visitas:
 *
 *   - SESSION_SECRET — HMAC key that signs admin session cookies.
 *   - TRACKER_SIGNING_KEY — HMAC key that signs the generated tracker config.
 *   - ADMIN_USER / ADMIN_PASSWORD — dashboard credentials.
 *
 * The tracker encryption key pair (RSA-2048, RSA-OAEP) is NOT generated here:
 * the Worker creates it on first use, stores it in D1 and rotates it
 * periodically. See `lib/keys.ts`.
 *
 * Usage:
 *   npm run keys:generate
 */

import { randomBytes } from "node:crypto";

const sessionSecret = randomBytes(32).toString("base64");
const signingKey = randomBytes(32).toString("base64");
const adminPassword = randomBytes(15).toString("base64url");

const secrets = [
  ["ADMIN_USER", "admin"],
  ["ADMIN_PASSWORD", adminPassword],
  ["SESSION_SECRET", sessionSecret],
  ["TRACKER_SIGNING_KEY", signingKey],
];

const devVars = secrets.map(([name, value]) => `${name}='${value}'`).join("\n");

console.log(`
  cf-visitas — generated secrets
  ────────────────────────────────────────────────────────────────────────────

  1) Local development — copy this block into .dev.vars:

${devVars}

  2) Production — store each value as a Worker secret:

${secrets.map(([name]) => `     npx wrangler secret put ${name}`).join("\n")}

     Paste the matching value when Wrangler prompts for it.

  Keep these values safe: anyone with SESSION_SECRET can forge admin sessions,
  and anyone with TRACKER_SIGNING_KEY can sign tracker configs.

  The tracker encryption key pair is generated and rotated by the Worker in D1.
  ────────────────────────────────────────────────────────────────────────────
`);
