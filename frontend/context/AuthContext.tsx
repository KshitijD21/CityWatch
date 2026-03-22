'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '@/types';
import { apiFetch } from '@/lib/api';
import { insforgeAuth } from '@/lib/insforge';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ onboarded: boolean }>;
  signup: (
    email: string,
    password: string,
    name: string,
    ageBand?: string
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Decode JWT and check if it's expired or within 60s of expiry.
 * Used to decide whether to use the cached token or call refreshSession().
 * NOTE: This is NOT validation — backend still verifies the signature on every request.
 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= (payload.exp * 1000) - 60_000;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  /** Fetch user profile from backend and update state. Clears token on failure. */
  const fetchUser = useCallback(async (token: string) => {
    try {
      const profile = await apiFetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setState({ user: profile, token, loading: false });
    } catch {
      localStorage.removeItem('token');
      setState({ user: null, token: null, loading: false });
    }
  }, []);

  /*
   * Restore session on mount.
   *
   * If the cached access token is still valid, uses it directly (avoids UI flash
   * and prevents CSRF token collision on rapid page reloads). Only calls
   * refreshSession() when the token is expired or missing — the httpOnly refresh
   * cookie is first-party (same-origin proxy) so it persists without proactive
   * renewal. The interval/focus effects handle renewal when the token expires.
   */
  useEffect(() => {
    async function restoreSession() {
      const saved = localStorage.getItem('token');

      // Show user immediately if we have a valid cached token (avoids flash)
      if (saved && !isTokenExpired(saved)) {
        await fetchUser(saved);
      }

      // Only refresh when token is expired/missing — avoids CSRF collision on rapid reloads.
      // Cookie is first-party (same-origin proxy), so it persists without proactive renewal.
      if (!saved || isTokenExpired(saved)) {
        const { data } = await insforgeAuth.auth
          .refreshSession()
          .catch(() => ({ data: null }));
        if (data?.accessToken) {
          localStorage.setItem('token', data.accessToken);
          await fetchUser(data.accessToken);
          return;
        }

        // Refresh failed — user needs to re-login
        if (saved) localStorage.removeItem('token');
        setState((s) => ({ ...s, loading: false }));
      }
    }
    restoreSession();
  }, [fetchUser]);

  /*
   * Keep session alive while the tab is active.
   *
   * - Interval (10 min): proactively refreshes before the 15-min access token expires.
   *   This keeps localStorage always holding a fresh token, so page reloads never
   *   need to call refreshSession(). Also keeps the CSRF token in sync since the
   *   SDK processes the response while the page is alive.
   *
   * - Tab focus: only refreshes if the token is expired or nearly expired (e.g., user
   *   switched away for a while). Avoids unnecessary refresh calls on quick tab switches.
   */
  useEffect(() => {
    async function refreshToken() {
      const token = localStorage.getItem('token');
      if (!token) return;

      const { data } = await insforgeAuth.auth
        .refreshSession()
        .catch(() => ({ data: null }));
      if (data?.accessToken) {
        localStorage.setItem('token', data.accessToken);
        setState((s) => s.user ? { ...s, token: data.accessToken } : s);
      }
    }

    const interval = setInterval(refreshToken, 10 * 60 * 1000);

    function onFocus() {
      const token = localStorage.getItem('token');
      if (token && isTokenExpired(token)) {
        refreshToken();
      }
    }
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  /** Sign in via InsForge SDK (sets httpOnly refresh cookie + CSRF token). */
  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await insforgeAuth.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data?.accessToken) {
      throw new Error(error?.message || 'Login failed');
    }
    const token = data.accessToken;
    localStorage.setItem('token', token);

    // Fetch profile from backend; if not found, create it (first login via SDK)
    try {
      const profile = await apiFetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setState({ user: profile, token, loading: false });
      return { onboarded: profile.onboarded };
    } catch {
      // Profile doesn't exist yet (first login) — create it
      await apiFetch('/api/auth/init', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: email.split('@')[0],
          age_band: 'adult',
        }),
      });
      const profile = await apiFetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setState({ user: profile, token, loading: false });
      return { onboarded: profile.onboarded };
    }
  }, []);

  /** Create auth user via InsForge SDK, then create profile row in backend. */
  const signup = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      ageBand: string = 'adult'
    ) => {
      const { data, error } = await insforgeAuth.auth.signUp({
        email,
        password,
        name,
      });
      if (error) {
        throw new Error(error.message || 'Signup failed');
      }
      const token = data?.accessToken;
      if (!token) {
        throw new Error('Signup failed: no access token returned');
      }
      localStorage.setItem('token', token);

      // Create user profile row in backend
      await apiFetch('/api/auth/init', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, age_band: ageBand }),
      });
      await fetchUser(token);
    },
    [fetchUser]
  );

  /** Clear local token, revoke InsForge session, and reset state. */
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    insforgeAuth.auth.signOut().catch(() => {});
    setState({ user: null, token: null, loading: false });
  }, []);

  /** Re-fetch user profile without re-authenticating (e.g., after onboarding). */
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (token) await fetchUser(token);
  }, [fetchUser]);

  return (
    <AuthContext.Provider
      value={{ ...state, login, signup, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
