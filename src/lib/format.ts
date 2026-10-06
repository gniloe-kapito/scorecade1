// Russian locale formatting helpers.

/** Russian plural forms: pluralRu(2, "оценка", "оценки", "оценок") → "оценки". */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const category = new Intl.PluralRules("ru-RU").select(n);
  if (category === "one") return one;
  if (category === "few") return few;
  return many;
}

export function timeAgo(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, "second");
  const min = Math.round(diffSec / 60);
  if (Math.abs(min) < 60) return rtf.format(-min, "minute");
  const hours = Math.round(min / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 31) return rtf.format(-days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(-months, "month");
  return rtf.format(-Math.round(months / 12), "year");
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatAverage(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

/** Tailwind classes for the Metacritic badge color tier. */
export function metacriticTone(score: number): string {
  if (score >= 75) return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
  if (score >= 50) return "border-amber-400/40 bg-amber-400/10 text-amber-300";
  return "border-red-400/40 bg-red-400/10 text-red-300";
}
