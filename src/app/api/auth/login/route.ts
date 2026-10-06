import { db } from "@/lib/db";
import {
  createSession,
  hashPassword,
  timingSafeEqualHex,
  jsonError,
} from "@/lib/auth";
import { cleanPassword, readJsonBody } from "@/lib/validate";
import { checkRate, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!checkRate(`login:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
    return jsonError("Слишком много попыток входа. Попробуйте позже.", 429);
  }

  const body = await readJsonBody(req);
  if (!body) return jsonError("Некорректный запрос.", 400);

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = cleanPassword(body.password);
  if (!username || !password) {
    return jsonError("Неверный никнейм или пароль.", 401);
  }

  const user = await db.user.findUnique({
    where: { usernameLower: username.toLowerCase() },
  });
  if (!user) {
    return jsonError("Неверный никнейм или пароль.", 401);
  }

  const candidate = await hashPassword(password, user.passwordSalt);
  if (!timingSafeEqualHex(candidate, user.passwordHash)) {
    return jsonError("Неверный никнейм или пароль.", 401);
  }

  const token = await createSession(user.id);
  return Response.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
    },
  });
}
