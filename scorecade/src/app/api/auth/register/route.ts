import { db } from "@/lib/db";
import { createSession, hashPassword, generateSalt, jsonError } from "@/lib/auth";
import { cleanPassword, cleanUsername, readJsonBody } from "@/lib/validate";
import { checkRate, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!checkRate(`register:${clientIp(req)}`, 5, 10 * 60 * 1000)) {
    return jsonError("Слишком много попыток регистрации. Попробуйте позже.", 429);
  }

  const body = await readJsonBody(req);
  if (!body) return jsonError("Некорректный запрос.", 400);

  const username = cleanUsername(body.username);
  if (!username) {
    return jsonError("Никнейм: 3–20 символов, только латиница, цифры и «_».", 400);
  }
  const password = cleanPassword(body.password);
  if (!password) {
    return jsonError("Пароль должен быть не короче 8 символов.", 400);
  }

  const usernameLower = username.toLowerCase();
  const existing = await db.user.findUnique({
    where: { usernameLower },
    select: { id: true },
  });
  if (existing) {
    return jsonError("Такой никнейм уже занят. Придумайте другой.", 409);
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const user = await db.user.create({
    data: {
      username,
      usernameLower,
      passwordHash,
      passwordSalt: salt,
    },
  });

  const token = await createSession(user.id);
  return Response.json(
    {
      token,
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
      },
    },
    { status: 201 },
  );
}
