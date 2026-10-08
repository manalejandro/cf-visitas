/**
 * Worker secrets used by cf-visitas.
 *
 * They are optional at the type level because the app degrades gracefully when
 * a deployment has not configured them yet (the API rejects unsigned beacons).
 * Set them with:
 *
 *   npx wrangler secret put <NAME>
 *
 * or via `.dev.vars` for local development (see `.dev.vars.example`).
 *
 * The tracker encryption key pair is NOT a secret: the Worker generates it,
 * stores it in D1 and rotates it automatically (see lib/keys.ts).
 */

declare namespace Cloudflare {
  interface Env {
    ADMIN_USER?: string;
    ADMIN_PASSWORD?: string;
    SESSION_SECRET?: string;
    TRACKER_SIGNING_KEY?: string;
    TRACKER_ENDPOINT_ORIGIN?: string;
    /** Set to "true" to add 'unsafe-eval' to the CSP script-src (Cloudflare Zaraz et al.). */
    CSP_ALLOW_EVAL?: string;
  }
}
