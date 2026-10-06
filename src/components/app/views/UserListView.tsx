"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";
import { Button } from "@/components/ui/button";
import { backOrHome } from "@/lib/router";
import { ChevronLeft } from "lucide-react";
import { SITE_NAME } from "@/lib/config";

export function UserListView({
  username,
  kind,
}: {
  username: string;
  kind: "followers" | "following";
}) {
  const listQuery = useQuery({
    queryKey: ["userList", username, kind],
    queryFn: () =>
      api<{ items: Array<{ username: string; avatarUrl: string | null }> }>(
        `/api/users/${encodeURIComponent(username)}/${kind}`,
      ),
    retry: 1,
  });

  const title = kind === "followers" ? "Подписчики" : "Подписки";

  useEffect(() => {
    document.title = `${title} ${username} — ${SITE_NAME}`;
  }, [title, username]);

  return (
    <div className="py-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={backOrHome}
        className="-ml-2 mb-4 text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden /> Назад
      </Button>
      <h1 className="text-2xl font-extrabold tracking-tight">
        {title}{" "}
        <span className="text-primary">{username}</span>
      </h1>

      <div className="mt-5">
        {listQuery.isLoading ? (
          <div className="rounded-2xl border border-border/70 bg-card/70 px-4">
            <ListSkeleton count={4} />
          </div>
        ) : listQuery.error ? (
          <EmptyState
            icon={Users}
            title="Не удалось загрузить список"
            hint={listQuery.error.message}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => listQuery.refetch()}
              >
                Повторить
              </Button>
            }
          />
        ) : (listQuery.data?.items ?? []).length === 0 ? (
          <EmptyState
            icon={Users}
            title={kind === "followers" ? "Пока никого" : "Ещё никого"}
            hint={
              kind === "followers"
                ? "Здесь появятся люди, которые подпишутся на этого пользователя."
                : "Этот пользователь пока ни на кого не подписан."
            }
          />
        ) : (
          <ul className="divide-y divide-border/60 rounded-2xl border border-border/70 bg-card/70 px-4">
            {(listQuery.data?.items ?? []).map((u) => (
              <li key={u.username}>
                <a
                  href={`#/u/${u.username}`}
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-secondary/30"
                >
                  <UserAvatar username={u.username} src={u.avatarUrl} size="md" />
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {u.username}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
