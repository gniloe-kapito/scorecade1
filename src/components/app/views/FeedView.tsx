"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Activity, LogIn, Newspaper, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { loginRedirectUrl } from "@/lib/router";
import { timeAgo } from "@/lib/format";
import { SITE_NAME } from "@/lib/config";
import { GameCover } from "@/components/app/GameCover";
import { ScoreBadge } from "@/components/app/ScoreBadge";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";
import { Button } from "@/components/ui/button";
import type { FeedItem } from "@/lib/types";

export function FeedView() {
  const { user, ready } = useAuth();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `Лента — ${SITE_NAME}`;
  }, []);

  const feedQuery = useInfiniteQuery({
    queryKey: ["feed"],
    enabled: !!user,
    queryFn: ({ pageParam }) =>
      api<{ items: FeedItem[]; nextCursor: string | null }>(
        pageParam ? `/api/feed?cursor=${pageParam}` : "/api/feed",
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !feedQuery.hasNextPage || feedQuery.isFetchingNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          feedQuery.hasNextPage &&
          !feedQuery.isFetchingNextPage
        ) {
          void feedQuery.fetchNextPage();
        }
      },
      { rootMargin: "500px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [
    feedQuery.hasNextPage,
    feedQuery.isFetchingNextPage,
    feedQuery.fetchNextPage,
  ]);

  if (!ready) {
    return (
      <div className="py-6">
        <ListSkeleton count={5} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-8">
        <EmptyState
          icon={LogIn}
          title="Лента оценок друзей"
          hint="Войдите в аккаунт — и здесь появятся последние оценки тех, на кого вы подписаны."
          action={
            <Button asChild>
              <a href={loginRedirectUrl()}>
                <LogIn className="h-4 w-4" aria-hidden /> Войти
              </a>
            </Button>
          }
        />
      </div>
    );
  }

  const items = feedQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const hasNextPage = feedQuery.hasNextPage;

  return (
    <div className="py-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Activity className="h-6 w-6 text-primary" aria-hidden />
          Лента
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Последние оценки тех, на кого вы подписаны
        </p>
      </header>

      {feedQuery.isLoading ? (
        <div className="rounded-2xl border border-border/70 bg-card/70 px-4">
          <ListSkeleton count={5} />
        </div>
      ) : feedQuery.error ? (
        <EmptyState
          icon={Newspaper}
          title="Не удалось загрузить ленту"
          hint={feedQuery.error.message}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => feedQuery.refetch()}
            >
              Повторить
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Пока пусто"
          hint="Подпишитесь на друзей — их оценки появятся здесь. Найти людей можно на страницах игр в блоке «Оценки друзей»."
          action={
            <Button asChild size="sm">
              <a href="#/">Найти игры</a>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((item) => (
              <FeedCard key={`${item.username}-${item.gameId}`} item={item} />
            ))}
          </ul>

          {/* infinite scroll sentinel */}
          <div ref={sentinelRef} aria-hidden className="h-1" />
          {feedQuery.isFetchingNextPage && (
            <div className="mt-3 rounded-2xl border border-border/70 bg-card/70 px-4">
              <ListSkeleton count={2} />
            </div>
          )}
          {!hasNextPage && (
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Вы всё посмотрели
            </p>
          )}
        </>
      )}
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <li className="group rounded-2xl border border-border/70 bg-card/70 p-3.5 transition-all hover:border-primary/25 hover:shadow-[0_10px_28px_-16px_rgba(166,227,77,0.22)]">
      <div className="flex items-stretch gap-3">
        <a href={`#/u/${item.username}`} className="shrink-0 self-start">
          <UserAvatar username={item.username} src={item.avatarUrl} size="md" />
        </a>
        <div className="min-w-0 flex-1">
          <p className="mt-1 break-words text-sm leading-snug">
            <a
              href={`#/u/${item.username}`}
              className="font-bold hover:text-primary"
            >
              {item.username}
            </a>{" "}
            <span className="text-muted-foreground">оценил(а)</span>{" "}
            <ScoreBadge score={item.score} size="sm" className="-translate-y-px" />{" "}
            <a
              href={`#/game/${item.gameId}`}
              className="font-bold hover:text-primary"
            >
              {item.gameName}
            </a>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {timeAgo(item.updatedAt)}
          </p>
          {item.review && (
            <p className="mt-2 break-words rounded-xl border-l-2 border-primary/40 bg-secondary/40 px-3 py-2 text-sm leading-relaxed text-foreground/80">
              {item.review}
            </p>
          )}
        </div>
        <a
          href={`#/game/${item.gameId}`}
          className="shrink-0 self-center"
          aria-label={`Открыть игру ${item.gameName}`}
        >
          <GameCover
            cover={item.gameCover}
            gameId={item.gameId}
            name={item.gameName}
            className="h-[72px] w-12 rounded-lg border border-border/60 shadow-sm transition-transform duration-200 group-hover:scale-[1.06]"
          />
        </a>
      </div>
    </li>
  );
}
