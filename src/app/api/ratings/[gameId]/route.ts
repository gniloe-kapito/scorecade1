import { db } from "@/lib/db";
import { getAuthUser, jsonError } from "@/lib/auth";
import {
  GAME_ID_RE,
  cleanGameCover,
  cleanGameName,
  cleanReview,
  parseScore,
  readJsonBody,
} from "@/lib/validate";
import { checkRate } from "@/lib/rate-limit";

type Params = { params: Promise<{ gameId: string }> };

/** Create or update my rating for a game. */
export async function PUT(req: Request, { params }: Params) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Не авторизован.", 401);

  if (!checkRate(`rating:${me.id}`, 60, 60 * 1000)) {
    return jsonError("Слишком часто. Немного подождите.", 429);
  }

  const { gameId: rawId } = await params;
  const gameId = decodeURIComponent(rawId);
  if (!GAME_ID_RE.test(gameId)) {
    return jsonError("Некорректный идентификатор игры.", 400);
  }

  const body = await readJsonBody(req);
  if (!body) return jsonError("Некорректный запрос.", 400);

  const score = parseScore(body.score);
  if (score === null) {
    return jsonError("Оценка должна быть целым числом от 0 до 10.", 400);
  }
  const gameName = cleanGameName(body.game_name);
  if (!gameName) return jsonError("Некорректное название игры.", 400);
  const gameCover = cleanGameCover(body.game_cover);
  const review = cleanReview(body.review);

  const rating = await db.rating.upsert({
    where: { userId_gameId: { userId: me.id, gameId } },
    create: { userId: me.id, gameId, gameName, gameCover, score, review },
    update: { gameName, gameCover, score, review },
  });

  // Rating implies having played the game — auto-set status='played'
  // (spec: «если выставляешь оценку, статус автоматически меняется на «играл»»).
  await db.gameStatus
    .upsert({
      where: { userId_gameId: { userId: me.id, gameId } },
      create: { userId: me.id, gameId, status: "played", gameName, gameCover },
      update: { status: "played", gameName, gameCover },
    })
    .catch((err) => console.error("status auto-played failed:", err));

  return Response.json({
    rating: {
      gameId: rating.gameId,
      gameName: rating.gameName,
      gameCover: rating.gameCover,
      score: rating.score,
      review: rating.review,
      updatedAt: rating.updatedAt,
    },
  });
}

/** Remove my rating. */
export async function DELETE(req: Request, { params }: Params) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Не авторизован.", 401);

  const { gameId: rawId } = await params;
  const gameId = decodeURIComponent(rawId);
  if (!GAME_ID_RE.test(gameId)) {
    return jsonError("Некорректный идентификатор игры.", 400);
  }

  await db.rating
    .deleteMany({ where: { userId: me.id, gameId } })
    .catch(() => undefined);

  return Response.json({ ok: true });
}
