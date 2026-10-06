"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookmarkPlus,
  Camera,
  Clock3,
  Gamepad2,
  History,
  ImagePlus,
  Loader2,
  LogOut,
  Share2,
  Star,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatAverage, formatDate, pluralRu, timeAgo } from "@/lib/format";
import { SITE_NAME } from "@/lib/config";
import { GameCover } from "@/components/app/GameCover";
import { ScoreBadge } from "@/components/app/ScoreBadge";
import { UserAvatar } from "@/components/app/UserAvatar";
import { FollowButton } from "@/components/app/FollowButton";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionTitle } from "@/components/app/SectionTitle";
import { ListSkeleton } from "@/components/app/Skeletons";
import { Button } from "@/components/ui/button";
import type { AuthUser, ProfileResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALLOWED_PIC_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_AVATAR_MB = 4;
const MAX_BANNER_MB = 8;

type PictureType = "avatar" | "banner";

export function ProfileView({
  username,
  isMe = false,
}: {
  username: string;
  isMe?: boolean;
}) {
  const { logout, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | number>("all");
  const [sort, setSort] = useState<SortKey>("new");
  const [tab, setTab] = useState<"ratings" | "wants">("ratings");

  // ---- avatar / banner uploads (kappa.lol, own profile only) ----
  const [picBusy, setPicBusy] = useState<PictureType | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${username} — ${SITE_NAME}`;
  }, [username]);

  const profileQuery = useQuery({
    queryKey: ["profile", username],
    queryFn: () =>
      api<ProfileResponse>(`/api/users/${encodeURIComponent(username)}`),
    retry: 1,
  });

  const data = profileQuery.data;
  const ratings = data?.ratings ?? [];
  const wants = data?.wants ?? [];
  const distribution = data?.user.stats.distribution ?? [];
  const maxCount = Math.max(1, ...distribution);

  const filtered = useMemo(
    () => (filter === "all" ? ratings : ratings.filter((r) => r.score === filter)),
    [ratings, filter],
  );

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "old":
        return list.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
      case "best":
        return list.sort(
          (a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt),
        );
      case "worst":
        return list.sort(
          (a, b) => a.score - b.score || b.updatedAt.localeCompare(a.updatedAt),
        );
      default:
        return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
  }, [filtered, sort]);

  if (profileQuery.isLoading) {
    return (
      <div className="py-6">
        <div className="flex items-center gap-4">
          <ListSkeleton count={4} />
        </div>
      </div>
    );
  }

  if (profileQuery.error || !data) {
    return (
      <div className="py-8">
        <EmptyState
          icon={UserX}
          title="Пользователь не найден"
          hint="Проверьте ссылку — возможно, в никнейме опечатка."
          action={
            <Button asChild variant="secondary">
              <a href="#/">На главную</a>
            </Button>
          }
        />
      </div>
    );
  }

  const user = data.user;

  /** Apply a freshly uploaded/removed picture everywhere it is cached. */
  const applyPictureUser = (next: AuthUser) => {
    updateUser(next);
    queryClient.setQueryData<ProfileResponse>(["profile", user.username], (old) =>
      old
        ? {
            ...old,
            user: {
              ...old.user,
              avatarUrl: next.avatarUrl,
              bannerUrl: next.bannerUrl,
            },
          }
        : old,
    );
    void queryClient.invalidateQueries({ queryKey: ["userSearch"] });
  };

  const uploadPicture = async (type: PictureType, file: File) => {
    if (!ALLOWED_PIC_TYPES.has(file.type)) {
      toast.error("Поддерживаются форматы PNG, JPEG, WebP и GIF.");
      return;
    }
    const maxMb = type === "avatar" ? MAX_AVATAR_MB : MAX_BANNER_MB;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Файл слишком большой — максимум ${maxMb} МБ.`);
      return;
    }
    setPicBusy(type);
    try {
      const form = new FormData();
      form.append("type", type);
      form.append("file", file);
      const res = await api<{ user: AuthUser }>("/api/me/picture", {
        method: "POST",
        body: form,
      });
      applyPictureUser(res.user);
      toast(type === "avatar" ? "Аватарка обновлена" : "Баннер обновлён");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось загрузить изображение",
      );
    } finally {
      setPicBusy(null);
    }
  };

  const removePicture = async (type: PictureType) => {
    setPicBusy(type);
    try {
      const res = await api<{ user: AuthUser }>(`/api/me/picture?type=${type}`, {
        method: "DELETE",
      });
      applyPictureUser(res.user);
      toast(type === "avatar" ? "Аватарка убрана" : "Баннер убран");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не получилось удалить изображение",
      );
    } finally {
      setPicBusy(null);
    }
  };

  const handlePicSelect = (
    type: PictureType,
    files: FileList | null,
  ) => {
    const file = files?.[0];
    if (file) void uploadPicture(type, file);
  };

  const shareProfile = async () => {
    // Always share the canonical #/u/<username> link — never window.location
    // (viewing your own profile via #/me would copy "#/me", which opens the
    // RECIPIENT's own profile instead of yours).
    const url = `${window.location.origin}/#/u/${encodeURIComponent(user.username)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${user.username} — ${SITE_NAME}`,
          text: `Профиль ${user.username} в ${SITE_NAME}`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Ссылка на профиль скопирована");
    } catch {
      /* share sheet dismissed — not an error */
    }
  };

  return (
    <div className="py-6">
      {/* Profile header: banner + avatar (uploads on the own profile) */}
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">
        {/* Banner */}
        <div className="relative h-28 sm:h-36">
          {user.bannerUrl ? (
            <img
              src={user.bannerUrl}
              alt={`Баннер профиля ${user.username}`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="h-full w-full bg-gradient-to-r from-primary/15 via-primary/5 to-transparent"
            />
          )}
          {isMe && (
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              {user.bannerUrl && (
                <button
                  type="button"
                  onClick={() => void removePicture("banner")}
                  disabled={picBusy !== null}
                  aria-label="Убрать баннер"
                  title="Убрать баннер"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/75 text-muted-foreground backdrop-blur-sm transition-colors hover:border-destructive/60 hover:text-destructive"
                >
                  {picBusy === "banner" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <X className="h-4 w-4" aria-hidden />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                disabled={picBusy !== null}
                aria-label="Загрузить баннер"
                title="Загрузить баннер"
                className="flex h-8 items-center gap-1.5 rounded-full border border-border/60 bg-background/75 px-3 text-xs font-bold text-foreground/85 backdrop-blur-sm transition-colors hover:border-primary/50 hover:text-primary"
              >
                {picBusy === "banner" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="hidden sm:inline">Баннер</span>
              </button>
            </div>
          )}
        </div>

        {/* Avatar + name + actions */}
        <div className="flex flex-col items-start gap-4 px-5 pb-5 sm:flex-row sm:items-center">
          <div className="relative -mt-10 shrink-0 sm:-mt-12">
            <UserAvatar
              username={user.username}
              src={user.avatarUrl}
              size="xl"
              className="ring-4 ring-card"
            />
            {isMe && (
              <div className="absolute -bottom-1.5 -right-1 flex items-center gap-1.5">
                {user.avatarUrl && (
                  <button
                    type="button"
                    onClick={() => void removePicture("avatar")}
                    disabled={picBusy !== null}
                    aria-label="Убрать аватарку"
                    title="Убрать аватарку"
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-secondary text-muted-foreground shadow-md transition-colors hover:text-destructive"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={picBusy !== null}
                  aria-label="Загрузить аватарку"
                  title="Загрузить аватарку"
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110"
                >
                  {picBusy === "avatar" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Camera className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-extrabold tracking-tight">
                {user.username}
              </h1>
              {isMe && (
                <span className="rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                  это вы
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              В {SITE_NAME} с {formatDate(user.createdAt)}
            </p>
          </div>
          {isMe ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void shareProfile()}
                aria-label="Поделиться профилем"
              >
                <Share2 className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Поделиться</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await logout();
                  toast("Вы вышли из аккаунта");
                  window.location.hash = "#/";
                }}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Выйти
              </Button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void shareProfile()}
                aria-label="Поделиться профилем"
              >
                <Share2 className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Поделиться</span>
              </Button>
              <FollowButton
                username={user.username}
                initialFollowing={user.isFollowing}
                size="default"
              />
            </div>
          )}
        </div>
      </section>

      {/* Hidden file pickers (own profile only) */}
      {isMe && (
        <>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              handlePicSelect("avatar", e.target.files);
              e.target.value = ""; // allow re-picking the same file
            }}
          />
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              handlePicSelect("banner", e.target.files);
              e.target.value = ""; // allow re-picking the same file
            }}
          />
        </>
      )}

      {/* Stats */}
      <section
        aria-label="Статистика профиля"
        className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <StatCard
          label={pluralRu(user.stats.count, "оценка", "оценки", "оценок")}
          value={String(user.stats.count)}
          icon={Gamepad2}
        />
        <StatCard label="Средняя" value={formatAverage(user.stats.average)} icon={Star} />
        <StatCard
          label={pluralRu(user.followers, "подписчик", "подписчика", "подписчиков")}
          value={String(user.followers)}
          icon={Users}
          href={`#/u/${user.username}/followers`}
          ariaLabel={`Подписчики ${user.username}: ${user.followers}`}
        />
        <StatCard
          label={pluralRu(user.following, "подписка", "подписки", "подписок")}
          value={String(user.following)}
          icon={UserPlus}
          href={`#/u/${user.username}/following`}
          ariaLabel={`Подписки ${user.username}: ${user.following}`}
        />
      </section>

      {/* Ratings / wants tabs */}
      <div
        role="tablist"
        aria-label="Списки профиля"
        className="mt-4 grid grid-cols-2 gap-2"
      >
        <ProfileTabButton
          active={tab === "ratings"}
          icon={Star}
          label="Оценки"
          count={user.stats.count}
          onClick={() => setTab("ratings")}
        />
        <ProfileTabButton
          active={tab === "wants"}
          icon={BookmarkPlus}
          label="Хочу поиграть"
          count={user.wants}
          onClick={() => setTab("wants")}
        />
      </div>

      {tab === "ratings" ? (
        <>
      {/* Distribution chart */}
      {user.stats.count > 0 && (
        <section
          aria-label="Распределение оценок"
          className="mt-4 rounded-2xl border border-border/70 bg-card/70 p-4"
        >
          <SectionTitle>
            <Star className="h-4 w-4 text-primary" aria-hidden />
            Распределение оценок
          </SectionTitle>
          <div className="flex h-28 items-end gap-1.5">
            {distribution.map((count, digit) => {
              const active = filter === digit;
              return (
                <button
                  key={digit}
                  type="button"
                  onClick={() => setFilter(active ? "all" : digit)}
                  aria-label={`Оценка ${digit}: ${count} ${pluralRu(count, "игра", "игры", "игр")} — фильтровать`}
                  aria-pressed={active}
                  className="group flex h-full flex-1 cursor-pointer flex-col items-center justify-end gap-1"
                >
                  {count > 0 && (
                    <span
                      className={cn(
                        "text-[10px] font-bold tabular-nums",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  )}
                  <span
                    className={cn(
                      "w-full rounded-t-md transition-all",
                      active
                        ? "bg-primary shadow-[0_0_12px_var(--primary)]"
                        : "bg-primary/30 group-hover:bg-primary/55",
                    )}
                    style={{
                      height:
                        count === 0
                          ? "3px"
                          : `${Math.max(8, (count / maxCount) * 100)}%`,
                    }}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-bold tabular-nums",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {digit}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter chips */}
      {user.stats.count > 0 && (
        <section
          aria-label="Фильтр по оценке"
          className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1"
        >
          <FilterChip
            active={filter === "all"}
            label="Все"
            count={user.stats.count}
            onClick={() => setFilter("all")}
          />
          {distribution.map((count, digit) => (
            <FilterChip
              key={digit}
              active={filter === digit}
              label={String(digit)}
              count={count}
              disabled={count === 0}
              onClick={() => setFilter(digit)}
            />
          ))}
        </section>
      )}

      {/* Sorting */}
      {user.stats.count > 0 && (
        <section
          aria-label="Сортировка оценок"
          className="no-scrollbar mt-4 flex items-center gap-2 overflow-x-auto pb-1"
        >
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Сортировка:
          </span>
          {SORT_OPTIONS.map((opt) => (
            <SortPill
              key={opt.key}
              active={sort === opt.key}
              icon={opt.icon}
              label={opt.label}
              onClick={() => setSort(opt.key)}
            />
          ))}
        </section>
      )}

      {/* Ratings list */}
      <section aria-label="Оценки пользователя" className="mt-4">
        {sorted.length === 0 ? (
          <EmptyState
            icon={Gamepad2}
            title={
              user.stats.count === 0
                ? isMe
                  ? "Вы пока ничего не оценили"
                  : `${user.username} пока ничего не оценил`
                : "Нет игр с такой оценкой"
            }
            hint={
              user.stats.count === 0
                ? "Найдите игру через поиск и нажмите на звёздочку!"
                : undefined
            }
            action={
              user.stats.count === 0 ? (
                <Button asChild size="sm">
                  <a href="#/">К поиску игр</a>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border/60 rounded-2xl border border-border/70 bg-card/70 px-4">
            {sorted.map((r) => (
              <li key={r.gameId}>
                <a
                  href={`#/game/${r.gameId}`}
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-secondary/30"
                >
                  <GameCover
                    cover={r.gameCover}
                    gameId={r.gameId}
                    name={r.gameName}
                    className="h-[72px] w-12 rounded-lg border border-border/60"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.gameName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {timeAgo(r.updatedAt)}
                    </p>
                    {r.review && (
                      <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-foreground/70">
                        «{r.review}»
                      </p>
                    )}
                  </div>
                  <ScoreBadge score={r.score} size="md" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ratings.length > 20 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Показаны все оценки — {ratings.length} {pluralRu(ratings.length, "штука", "штуки", "штук")}.
        </p>
      )}
        </>
      ) : (
        /* ---- Wants list ---- */
        <section aria-label="Хочу поиграть" className="mt-4">
          {wants.length === 0 ? (
            <EmptyState
              icon={BookmarkPlus}
              title={
                isMe
                  ? "Список «Хочу поиграть» пуст"
                  : `${user.username} пока не отметил ни одной игры`
              }
              hint={
                isMe
                  ? "На странице игры нажмите «Хочу поиграть» — игра появится здесь."
                  : undefined
              }
              action={
                isMe ? (
                  <Button asChild size="sm">
                    <a href="#/">Найти игру</a>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-border/60 rounded-2xl border border-border/70 bg-card/70 px-4">
              {wants.map((w) => (
                <li key={w.gameId}>
                  <a
                    href={`#/game/${w.gameId}`}
                    className="flex items-center gap-3 py-3 transition-colors hover:bg-secondary/30"
                  >
                    <GameCover
                      cover={w.gameCover}
                      gameId={w.gameId}
                      name={w.gameName}
                      className="h-[72px] w-12 rounded-lg border border-border/60"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{w.gameName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        добавлено {timeAgo(w.updatedAt)}
                      </p>
                    </div>
                    <BookmarkPlus
                      className="h-4 w-4 shrink-0 text-primary/60"
                      aria-hidden
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

type SortKey = "new" | "old" | "best" | "worst";

const SORT_OPTIONS: Array<{
  key: SortKey;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
}> = [
  { key: "new", label: "Сначала новые", icon: Clock3 },
  { key: "old", label: "Сначала старые", icon: History },
  { key: "best", label: "Высокие оценки", icon: TrendingUp },
  { key: "worst", label: "Низкие оценки", icon: TrendingDown },
];

function SortPill({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border/70 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function ProfileTabButton({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-bold transition-all active:scale-[0.98]",
        active
          ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_16px_-6px_rgba(166,227,77,0.5)]"
          : "border-border/70 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-px text-[10px] font-extrabold tabular-nums",
          active ? "bg-primary/20" : "bg-secondary",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  ariaLabel,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  href?: string;
  ariaLabel?: string;
}) {
  const body = (
    <>
      <Icon
        className="absolute right-3.5 top-3.5 h-4 w-4 text-primary/50"
        aria-hidden
      />
      <p className="text-2xl font-extrabold tabular-nums text-primary">
        {value}
      </p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </>
  );
  const base =
    "relative rounded-2xl border border-border/70 bg-card/70 p-4 transition-all";
  if (href) {
    return (
      <a
        href={href}
        aria-label={ariaLabel ?? label}
        className={cn(base, "hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgba(166,227,77,0.25)]")}
      >
        {body}
      </a>
    );
  }
  return <div className={base}>{body}</div>;
}

function FilterChip({
  active,
  label,
  count,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border/70 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40 hover:border-border/70",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] tabular-nums",
          active ? "bg-primary/20" : "bg-secondary",
        )}
      >
        {count}
      </span>
    </button>
  );
}
