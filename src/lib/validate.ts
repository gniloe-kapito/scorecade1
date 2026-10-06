// Input validation helpers shared by API routes (spec §8: validate everything).

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const GAME_ID_RE = /^steam:\d{1,8}$/;

export function parseScore(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 10) {
    return null;
  }
  return n;
}

export function cleanUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!USERNAME_RE.test(v)) return null;
  return v;
}

export function cleanPassword(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    return null;
  }
  return value;
}

/** Review: up to 1000 chars, control characters stripped (newline kept). */
export function cleanReview(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const v = value
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 1000);
  return v.length > 0 ? v : null;
}

/** Denormalized game name written by the client — keep it short and tag-free. */
export function cleanGameName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/[<>]/g, "").trim().slice(0, 200);
  return v.length > 0 ? v : null;
}

export function cleanGameCover(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (!/^https:\/\//i.test(value) || value.length > 500) return null;
  return value;
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
