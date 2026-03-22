"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "@/types";
import { apiFetch } from "@/lib/api";
import { insforge } from "@/lib/insforge";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  const fetchUser = useCallback(async (token: string) => {
    try {
      const profile = await apiFetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setState({ user: profile, token, loading: false });
    } catch {
      localStorage.removeItem("token");
      setState({ user: null, token: null, loading: false });
    }
  }, []);

  // Restore session on mount from localStorage
  useEffect(() => {
    async function restoreSession() {
      // Try to refresh the token via InsForge httpOnly cookie
      const { data } = await insforge.auth.refreshSession().catch(() => ({ data: null }));
      if (data?.accessToken) {
        localStorage.setItem("token", data.accessToken);
        await fetchUser(data.accessToken);
        return;
      }
      // Fall back to stored token
      const saved = localStorage.getItem("token");
      if (saved) {
        fetchUser(saved);
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    }
  }, [fetchUser]);

  // Keep session alive — re-validate token on tab focus
  useEffect(() => {
    async function refreshToken() {
      const { data } = await insforge.auth.refreshSession().catch(() => ({ data: null }));
      if (data?.accessToken) {
        localStorage.setItem("token", data.accessToken);
      }
    }

    const interval = setInterval(refreshToken, 10 * 60 * 1000);

    function onFocus() { refreshToken(); }
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("token", res.token);
      await fetchUser(res.token);
      return { onboarded: res.onboarded };
    },
    [fetchUser]
  );

  const signup = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      ageBand: string = "adult"
    ) => {
      const res = await apiFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          name,
          age_band: ageBand,
        }),
      });
      localStorage.setItem("token", res.token);
      await fetchUser(res.token);
    },
    [fetchUser]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setState({ user: null, token: null, loading: false });
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("token");
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
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
