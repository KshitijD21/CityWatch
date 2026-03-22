import InsForge from '@insforge/sdk';

const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const insforgeAnonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;

/** Main SDK instance — direct connection to InsForge for realtime WebSocket. */
export const insforge = new InsForge({
  baseUrl: insforgeUrl,
  anonKey: insforgeAnonKey,
});

/**
 * Auth SDK instance — routed through Next.js rewrite proxy (same-origin).
 *
 * Chrome blocks third-party cookies from cross-origin responses, which prevents
 * InsForge's httpOnly refresh token cookie from persisting across page reloads.
 * By proxying auth requests through our own origin (via next.config.ts rewrites),
 * the cookie is set as first-party and persists correctly.
 *
 * SDK uses `new URL(path, baseUrl)` — auth paths are absolute (/api/auth/...),
 * so only the origin from baseUrl matters.
 */
const authBaseUrl =
  typeof window !== 'undefined' ? window.location.origin : insforgeUrl;

export const insforgeAuth = new InsForge({
  baseUrl: authBaseUrl,
  anonKey: insforgeAnonKey,
});
