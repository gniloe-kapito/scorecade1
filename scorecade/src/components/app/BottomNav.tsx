"use client";

import { Activity, Search, UserRound } from "lucide-react";
import { useHashRoute } from "@/lib/router";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "#/", label: "Поиск", icon: Search, active: (p: string) => p === "/" },
  { href: "#/feed", label: "Лента", icon: Activity, active: (p: string) => p.startsWith("/feed") },
  {
    href: "#/me",
    label: "Профиль",
    icon: UserRound,
    active: (p: string) => p.startsWith("/me") || p.startsWith("/u"),
  },
];

export function BottomNav() {
  const route = useHashRoute();
  return (
    <nav
      aria-label="Нижняя навигация"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex w-full max-w-[900px]">
        {ITEMS.map((item) => {
          const active = item.active(route.path);
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-2.5 text-[11px] font-semibold transition-transform active:scale-95",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
