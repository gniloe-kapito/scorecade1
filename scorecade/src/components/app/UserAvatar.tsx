"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-xl",
  xl: "h-16 w-16 text-2xl md:h-20 md:w-20 md:text-3xl",
};

/**
 * User avatar: uploaded picture (kappa.lol) with a letter-placeholder
 * fallback for users without a picture or when the image fails to load.
 */
export function UserAvatar({
  username,
  src,
  size = "md",
  className,
}: {
  username: string;
  /** Uploaded avatar URL (kappa.lol) — null renders the letter placeholder. */
  src?: string | null;
  size?: Size;
  className?: string;
}) {
  // Remember which URL failed to load — a different src gets a fresh chance.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && src !== failedSrc;

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full border font-extrabold",
        showImage
          ? "overflow-hidden border-transparent bg-secondary p-0"
          : "border-primary/25 bg-gradient-to-br from-primary/30 to-primary/5 text-primary",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src ?? null)}
          className="h-full w-full object-cover"
        />
      ) : (
        (username?.[0] ?? "?").toUpperCase()
      )}
    </span>
  );
}
