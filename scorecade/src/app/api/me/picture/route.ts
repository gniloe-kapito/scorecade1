import { db } from "@/lib/db";
import { getAuthUser, jsonError } from "@/lib/auth";
import { checkRate } from "@/lib/rate-limit";
import { uploadToKappa, deleteFromKappa } from "@/lib/kappa";

// Profile picture uploads (avatar / banner) → kappa.lol.
//   POST   /api/me/picture   multipart: type=avatar|banner, file=<image>
//   DELETE /api/me/picture?type=avatar|banner

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_BANNER_BYTES = 8 * 1024 * 1024; // 8 MB

type PictureType = "avatar" | "banner";

function validateType(raw: string | null): PictureType | null {
  return raw === "avatar" || raw === "banner" ? raw : null;
}

/** POST — upload a new avatar/banner (replaces the old one on kappa.lol). */
export async function POST(req: Request) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Войдите, чтобы загрузить изображение.", 401);
  if (!checkRate(`picture:${me.id}`, 6, 10 * 60 * 1000)) {
    return jsonError("Слишком много загрузок подряд. Попробуйте позже.", 429);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError("Некорректный запрос.", 400);

  const type = validateType(String(form.get("type") ?? ""));
  if (!type) return jsonError("Неверный тип изображения.", 400);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError("Файл не найден.", 400);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return jsonError("Поддерживаются форматы PNG, JPEG, WebP и GIF.", 415);
  }
  const maxBytes = type === "avatar" ? MAX_AVATAR_BYTES : MAX_BANNER_BYTES;
  if (file.size > maxBytes) {
    return jsonError(
      `Файл слишком большой — максимум ${Math.round(maxBytes / (1024 * 1024))} МБ.`,
      413,
    );
  }

  // Forward to kappa.lol from the server (API key, if any, stays server-side).
  let uploaded;
  try {
    uploaded = await uploadToKappa(file);
  } catch (err) {
    console.error("kappa upload error:", err);
    return jsonError(
      "Хостинг картинок не ответил. Попробуйте ещё раз чуть позже.",
      502,
    );
  }

  // Best-effort cleanup of the replaced picture.
  const prev = await db.user.findUnique({
    where: { id: me.id },
    select: { avatarKey: true, bannerKey: true },
  });
  const oldKey = type === "avatar" ? prev?.avatarKey : prev?.bannerKey;
  if (oldKey) void deleteFromKappa(oldKey);

  const user = await db.user.update({
    where: { id: me.id },
    data:
      type === "avatar"
        ? { avatarUrl: uploaded.link, avatarKey: uploaded.key }
        : { bannerUrl: uploaded.link, bannerKey: uploaded.key },
    select: { id: true, username: true, avatarUrl: true, bannerUrl: true },
  });

  return Response.json({ user });
}

/** DELETE — remove the current avatar/banner. */
export async function DELETE(req: Request) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Войдите.", 401);

  const url = new URL(req.url);
  const type = validateType(url.searchParams.get("type"));
  if (!type) return jsonError("Неверный тип изображения.", 400);

  const prev = await db.user.findUnique({
    where: { id: me.id },
    select: { avatarKey: true, bannerKey: true },
  });
  const oldKey = type === "avatar" ? prev?.avatarKey : prev?.bannerKey;
  if (oldKey) void deleteFromKappa(oldKey);

  const user = await db.user.update({
    where: { id: me.id },
    data:
      type === "avatar"
        ? { avatarUrl: null, avatarKey: null }
        : { bannerUrl: null, bannerKey: null },
    select: { id: true, username: true, avatarUrl: true, bannerUrl: true },
  });

  return Response.json({ user });
}
