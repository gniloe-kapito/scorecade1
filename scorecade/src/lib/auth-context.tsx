"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, getToken, setToken } from "@/lib/api-client";
import type { AuthUser } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  register: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Replace the cached user (e.g. after an avatar/banner upload). */
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  // Restore session on first mount
  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) {
      // No token: flip to ready asynchronously (avoid sync setState in effect)
      queueMicrotask(() => {
        if (!cancelled) setReady(true);
      });
      return () => {
        cancelled = true;
      };
    }
    api<{ user: AuthUser }>("/api/me")
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        setToken(null); // invalid or expired token
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await api<{ token: string; user: AuthUser }>(
        "/api/auth/login",
        { method: "POST", body: { username, password } },
      );
      setToken(data.token);
      setUser(data.user);
      queryClient.clear();
      return data.user;
    },
    [queryClient],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const data = await api<{ token: string; user: AuthUser }>(
        "/api/auth/register",
        { method: "POST", body: { username, password } },
      );
      setToken(data.token);
      setUser(data.user);
      queryClient.clear();
      return data.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* session may already be gone */
    }
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const updateUser = useCallback((next: AuthUser) => {
    setUser(next);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, updateUser }),
    [user, ready, login, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
