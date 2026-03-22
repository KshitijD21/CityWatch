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
import { insforge } from '@/lib/insforge';

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

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Expired if less than 60s remaining
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

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      const saved = localStorage.getItem('token');

      // 1. If token exists and is still valid, use it directly (no refresh call)
      if (saved && !isTokenExpired(saved)) {
        await fetchUser(saved);
        return;
      }

      // 2. Token expired or missing — try SDK refresh via httpOnly cookie
      const { data } = await insforge.auth
        .refreshSession()
        .catch(() => ({ data: null }));
      if (data?.accessToken) {
        localStorage.setItem('token', data.accessToken);
        await fetchUser(data.accessToken);
        return;
      }

      // 3. Refresh failed — clean up stale token
      if (saved) localStorage.removeItem('token');
      setState((s) => ({ ...s, loading: false }));
    }
    restoreSession();
  }, [fetchUser]);

  // Keep session alive — refresh token on interval and tab focus
  useEffect(() => {
    async function refreshToken() {
      const token = localStorage.getItem('token');
      if (!token) return;

      const { data } = await insforge.auth
        .refreshSession()
        .catch(() => ({ data: null }));
      if (data?.accessToken) {
        localStorage.setItem('token', data.accessToken);
        setState((s) => s.user ? { ...s, token: data.accessToken } : s);
      }
    }

    // Refresh every 10 min while tab is active (well before 15-min expiry)
    const interval = setInterval(refreshToken, 10 * 60 * 1000);

    function onFocus() {
      const token = localStorage.getItem('token');
      // Only refresh on focus if token is expired or close to expiry
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

  const login = useCallback(async (email: string, password: string) => {
    // SDK-first: sign in via InsForge SDK (sets httpOnly refresh cookie)
    const { data, error } = await insforge.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data?.accessToken) {
      throw new Error(error?.message || 'Login failed');
    }
    const token = data.accessToken;
    localStorage.setItem('token', token);

    // Fetch profile from backend — also handles first-time user row creation
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

  const signup = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      ageBand: string = 'adult'
    ) => {
      // SDK-first: create auth user via InsForge SDK
      const { data, error } = await insforge.auth.signUp({
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

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    insforge.auth.signOut().catch(() => {});
    setState({ user: null, token: null, loading: false });
  }, []);

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
