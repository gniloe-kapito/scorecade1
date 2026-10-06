"use client";

import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useHashRoute } from "@/lib/router";
import { UserAvatar } from "./UserAvatar";
import { Wordmark } from "./Wordmark";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "#/", label: "Поиск", active: (p: string) => p === "/" },
  { href: "#/feed", label: "Лента", active: (p: string) => p.startsWith("/feed") },
  {
    href: "#/me",
    label: "Мой профиль",
    active: (p: string) => p.startsWith("/me") || p.startsWith("/u"),
  },
];

export function Header() {
  const { user, ready } = useAuth();
  const route = useHashRoute();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[900px] items-center justify-between gap-2 px-4">
        <a href="#/" aria-label="На главную" className="flex items-center gap-2">
          <Wordmark />
        </a>

        <nav
          aria-label="Основная навигация"
          className="hidden items-center gap-1 md:flex"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.active(route.path);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {ready && !user && (
            <>
              <Button asChild variant="ghost" size="sm">
                <a href="#/login">
                  <LogIn className="h-4 w-4" aria-hidden />
                  Войти
                </a>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <a href="#/register">
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Регистрация
                </a>
              </Button>
            </>
          )}
          {user && (
            <a
              href="#/me"
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card py-1 pl-1 pr-3 transition-colors hover:border-primary/40"
              aria-label={`Профиль ${user.username}`}
            >
              <UserAvatar username={user.username} src={user.avatarUrl} size="sm" />
              <span className="max-w-[120px] truncate text-sm font-semibold">
                {user.username}
              </span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
