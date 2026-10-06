"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Gamepad2,
  Search,
  SearchX,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SITE_NAME } from "@/lib/config";
import { GameCover } from "@/components/app/GameCover";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionTitle } from "@/components/app/SectionTitle";
import { CoverGridSkeleton, ListSkeleton } from "@/components/app/Skeletons";
import { UserAvatar } from "@/components/app/UserAvatar";
import { FollowButton } from "@/components/app/FollowButton";
import { Button } from "@/components/ui/button";
import { formatAverage, metacriticTone, pluralRu } from "@/lib/format";
import type {
  CommunityTopItem,
  Game,
  SearchItem,
  UserSearchItem,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function HomeView() {
  const { user, ready } = useAuth();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const trimmed = debounced.trim();
  const searching = trimmed.length >= 2;

  useEffect(() => {
    document.title = `${SITE_NAME} — оценки игр из Steam`;
  }, []);

  const searchQuery = useQuery({
    queryKey: ["gameSearch", trimmed],
    queryFn: () =>
      api<{ items: SearchItem[] }>(
        `/api/games/search?q=${encodeURIComponent(trimmed)}`,
      ),
    enabled: searching,
    staleTime: 5 * 60 * 1000,
  });

  const usersQuery = useQuery({
    queryKey: ["userSearch", trimmed],
    queryFn: () =>
      api<{ items: UserSearchItem[] }>(
        `/api/users/search?q=${encodeURIComponent(trimmed)}`,
      ),
    enabled: searching,
    staleTime: 0, // follow-state must be fresh on remount
  });

  const featuredQuery = useQuery({
    queryKey: ["featured"],
    queryFn: () => api<{ items: Game[] }>("/api/games/featured"),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const topQuery = useQuery({
    queryKey: ["communityTop"],
    queryFn: () => api<{ items: CommunityTopItem[] }>("/api/games/community-top"),
    staleTime: 60_000,
  });

  const gameItems = searchQuery.data?.items ?? [];
  const userItems = usersQuery.data?.items ?? [];
  const gamesLoaded = !searchQuery.isLoading && !searchQuery.error;
  const usersLoaded = !usersQuery.isLoading && !usersQuery.error;
  const nothingAtAll = searching && gamesLoaded && usersLoaded &&
    gameItems.length === 0 && userItems.length === 0;

  return (
    <div className="py-6 md:py-10">
      {/* Hero — search is the centerpiece */}
      <section className="relative mb-7 overflow-hidden text-center">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
        <div className="relative pt-4 pb-2">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
            <span className="bg-gradient-to-r from-primary via-lime-200 to-primary bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(166,227,77,0.3)]">
              Найдите игру
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
            Любая игра из Steam: описание, языки, системные требования и оценки
            друзей.
          </p>
        </div>
      </section>

      {/* Search */}
      <section aria-label="Поиск игр">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query.length > 0) {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
            placeholder="Найти игру или пользователя…"
            aria-label="Поиск игр и пользователей"
            autoComplete="off"
            className="h-12 w-full rounded-2xl border border-border/80 bg-background/70 pl-12 pr-11 text-base outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-border focus:border-primary/70 focus:ring-2 focus:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
        {query.trim().length > 0 && !searching && (
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Введите минимум 2 символа
          </p>
        )}
      </section>

      {/* Results / featured — vertical grids, never horizontal carousels */}
      <div className="mt-8">
        {searching ? (
          <section aria-label="Результаты поиска" aria-live="polite">
            {!nothingAtAll && (
              <div className="mb-7">
                <SectionTitle>
                  <Gamepad2 className="h-4 w-4 text-primary" aria-hidden />
                  Игры
                </SectionTitle>
                <SearchResults
                  loading={searchQuery.isLoading || (searchQuery.isFetching && !searchQuery.data)}
                  items={gameItems}
                  error={searchQuery.error?.message}
                  query={trimmed}
                  onRetry={() => searchQuery.refetch()}
                  compactEmpty={usersLoaded && userItems.length > 0}
                />
              </div>
            )}
            {!nothingAtAll && (usersQuery.isLoading || userItems.length > 0) && (
              <div>
                <SectionTitle>
                  <Users className="h-4 w-4 text-primary" aria-hidden />
                  Пользователи
                </SectionTitle>
                <UserSearchResults
                  loading={usersQuery.isLoading || (usersQuery.isFetching && !usersQuery.data)}
                  items={userItems}
                  error={usersQuery.error?.message}
                  onRetry={() => usersQuery.refetch()}
                />
              </div>
            )}
            {nothingAtAll && (
              <EmptyState
                icon={SearchX}
                title={`По запросу «${trimmed}» ничего не нашлось`}
                hint="Попробуйте другое написание или более короткий запрос — например, Portal или Witcher. Так же ищутся никнеймы пользователей."
              />
            )}
          </section>
        ) : (
          <>
            <section aria-label="Популярные игры" className="mb-8">
              <SectionTitle>
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                Популярное в Steam
              </SectionTitle>
              {featuredQuery.isLoading ? (
                <CoverGridSkeleton count={12} />
              ) : featuredQuery.error ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 p-4">
                  <p className="text-sm text-muted-foreground">
                    {featuredQuery.error.message}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => featuredQuery.refetch()}
                  >
                    Повторить
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {(featuredQuery.data?.items ?? []).map((g) => (
                    <a key={g.id} href={`#/game/${g.id}`} className="group">
                      <div className="relative overflow-hidden rounded-xl transition-all group-hover:shadow-[0_12px_32px_-12px_rgba(166,227,77,0.28)] ring-1 ring-border/60 group-hover:ring-primary/40">
                        <GameCover
                          cover={g.cover}
                          header={g.header}
                          gameId={g.id}
                          name={g.name}
                          className="aspect-[2/3] w-full rounded-xl border border-border/60 shadow-sm transition-transform group-hover:scale-[1.04]"
                        />
                        {g.metacritic !== null && (
                          <span
                            className={cn(
                              "absolute left-1.5 top-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold backdrop-blur-sm",
                              metacriticTone(g.metacritic),
                            )}
                          >
                            {g.metacritic}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug text-foreground/85">
                        {g.name}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </section>

            {/* Community top */}
            {(topQuery.data?.items ?? []).length > 0 && (
              <section aria-label="Топ игр по оценкам сообщества" className="mb-8">
                <SectionTitle>
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
                  Топ по оценкам сообщества
                </SectionTitle>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {(topQuery.data?.items ?? []).map((t, idx) => (
                    <a key={t.gameId} href={`#/game/${t.gameId}`} className="group">
                      <div className="relative overflow-hidden rounded-xl transition-all group-hover:shadow-[0_12px_32px_-12px_rgba(166,227,77,0.28)] ring-1 ring-border/60 group-hover:ring-primary/40">
                        <GameCover
                          cover={t.gameCover}
                          gameId={t.gameId}
                          name={t.gameName}
                          className="aspect-[2/3] w-full rounded-xl shadow-sm transition-transform group-hover:scale-[1.04]"
                        />
                        <span
                          aria-hidden
                          className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md border border-primary/40 bg-background/85 text-[10px] font-extrabold text-primary backdrop-blur-sm"
                        >
                          {idx + 1}
                        </span>
                        <span className="absolute bottom-1.5 right-1.5 rounded-md border border-primary/40 bg-background/85 px-1.5 py-0.5 text-[10px] font-extrabold text-primary backdrop-blur-sm">
                          {formatAverage(t.average)}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug text-foreground/85">
                        {t.gameName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.count}{" "}
                        {pluralRu(t.count, "оценка", "оценки", "оценок")}
                      </p>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Anonymous CTA */}
            {ready && !user && (
              <section className="mt-2 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-5 text-center md:p-6">
                <h3 className="text-lg font-extrabold">
                  Заведите аккаунт в {SITE_NAME}
                </h3>
                <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Оценивайте игры, отмечайте «хочу поиграть», пишите отзывы и
                  подписывайтесь на друзей.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button asChild>
                    <a href="#/register">Создать аккаунт</a>
                  </Button>
                  <Button asChild variant="secondary">
                    <a href="#/login">Войти</a>
                  </Button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SearchResults({
  loading,
  items,
  error,
  query,
  onRetry,
  compactEmpty,
}: {
  loading: boolean;
  items: SearchItem[];
  error?: string;
  query: string;
  onRetry: () => void;
  /** Games not found but users exist → small inline note instead of a big empty state. */
  compactEmpty?: boolean;
}) {
  if (loading) return <CoverGridSkeleton count={12} />;
  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 p-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          {error}
        </p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Повторить
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    if (compactEmpty) {
      return (
        <p className="rounded-xl border border-dashed border-border/70 bg-card/30 px-4 py-3 text-sm text-muted-foreground">
          Игр по запросу «{query}» не нашлось — но смотрите раздел «Пользователи» ниже.
        </p>
      );
    }
    return null;
  }
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {items.map((item) => (
        <a key={item.id} href={`#/game/${item.id}`} className="group">
          <div className="relative overflow-hidden rounded-xl transition-all group-hover:shadow-[0_12px_32px_-12px_rgba(166,227,77,0.28)] ring-1 ring-border/60 group-hover:ring-primary/40">
            <GameCover
              cover={item.cover}
              header={item.header}
              gameId={item.id}
              name={item.name}
              className="aspect-[2/3] w-full rounded-xl border border-border/60 shadow-sm transition-transform group-hover:scale-[1.04]"
            />
            {item.metascore !== null && (
              <span
                className={cn(
                  "absolute left-1.5 top-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold backdrop-blur-sm",
                  metacriticTone(item.metascore),
                )}
              >
                {item.metascore}
              </span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug text-foreground/85">
            {item.name}
          </p>
        </a>
      ))}
    </div>
  );
}

function UserSearchResults({
  loading,
  items,
  error,
  onRetry,
}: {
  loading: boolean;
  items: UserSearchItem[];
  error?: string;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/70 p-2">
        <ListSkeleton count={3} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 p-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          {error}
        </p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Повторить
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/70 bg-card/30 px-4 py-3 text-sm text-muted-foreground">
        Пользователей с таким никнеймом не нашлось.
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((u) => (
        <li
          key={u.username}
          className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card/70 p-3 transition-all hover:border-primary/40 hover:bg-card hover:shadow-[0_8px_24px_-12px_rgba(166,227,77,0.25)]"
        >
          <a
            href={`#/u/${u.username}`}
            className="flex min-w-0 flex-1 items-center gap-3"
            title={u.isMe ? "Это ваш профиль" : `Профиль ${u.username}`}
          >
            <UserAvatar
              username={u.username}
              src={u.avatarUrl}
              size="md"
              className="transition-shadow group-hover:shadow-[0_0_16px_-2px_rgba(166,227,77,0.4)]"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                  {u.username}
                </span>
                {u.isMe && (
                  <span className="shrink-0 rounded-full border border-primary/40 bg-primary/15 px-1.5 py-px text-[10px] font-bold text-primary">
                    это вы
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {u.ratings}{" "}
                {pluralRu(u.ratings, "оценка", "оценки", "оценок")} ·{" "}
                {u.followers}{" "}
                {pluralRu(u.followers, "подписчик", "подписчика", "подписчиков")}
              </span>
            </span>
          </a>
          {!u.isMe && (
            <FollowButton
              username={u.username}
              initialFollowing={u.isFollowing}
              size="sm"
              className="shrink-0"
            />
          )}
        </li>
      ))}
    </ul>
  );
}
