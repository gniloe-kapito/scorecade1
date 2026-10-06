"use client";

import { useEffect, useState } from "react";

export interface RouteInfo {
  path: string; // '/game/steam:730'
  segments: string[]; // ['game', 'steam:730']
  query: URLSearchParams;
}

export function parseHash(hash: string): RouteInfo {
  const raw = (hash || "").replace(/^#/, "");
  const [pathPart, queryPart] = raw.split("?");
  const normalized = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const segments = normalized
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  return {
    path: normalized,
    segments,
    query: new URLSearchParams(queryPart ?? ""),
  };
}

/** Hash-based SPA router: #/game/steam:730, #/u/username, #/feed, #/me ... */
export function useHashRoute(): RouteInfo {
  const [route, setRoute] = useState<RouteInfo>(() =>
    parseHash(window.location.hash),
  );
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(to: string): void {
  window.location.hash = to;
}

export function backOrHome(): void {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = "#/";
}

export function loginRedirectUrl(): string {
  const from = window.location.hash || "#/";
  return `#/login?from=${encodeURIComponent(from)}`;
}
