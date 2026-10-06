"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface GameCoverProps {
  cover?: string | null;
  header?: string | null;
  gameId?: string | null;
  name: string;
  className?: string;
}

/**
 * Game cover image with a fallback chain:
 * vertical cover → header → CDN vertical → CDN header → letter placeholder.
 * Failed URLs are remembered, so the next source is tried automatically.
 */
export function GameCover({ cover, header, gameId, name, className }: GameCoverProps) {
  const appid = gameId?.startsWith("steam:") ? gameId.slice("steam:".length) : null;

  const sources = useMemo(() => {
    const list: (string | null | undefined)[] = [cover, header];
    if (appid) {
      list.push(`https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`);
      list.push(`https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`);
    }
    return list.filter((s): s is string => typeof s === "string" && s.length > 0);
  }, [cover, header, appid]);

  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const src = sources.find((s) => !failed.has(s));

  if (!src) {
    return (
      <div
        role="img"
        aria-label={`Обложка игры ${name}`}
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-primary/25 via-card to-secondary",
          className,
        )}
      >
        <span className="text-2xl font-extrabold text-primary/70">
          {(name?.trim()?.[0] ?? "?").toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Обложка игры ${name}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() =>
        setFailed((prev) => {
          const next = new Set(prev);
          next.add(src);
          return next;
        })
      }
      className={cn("bg-secondary object-cover", className)}
    />
  );
}
