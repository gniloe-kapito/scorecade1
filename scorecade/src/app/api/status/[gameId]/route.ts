import { db } from "@/lib/db";
import { getAuthUser, jsonError } from "@/lib/auth";
import {
  GAME_ID_RE,
  cleanGameCover,
  cleanGameName,
  readJsonBody,
} from "@/lib/validate";
import { checkRate } from "@/lib/rate-limit";

type Params = { params: Promise<{ gameId: string }> };

/** Valid status values. 'none' removes the row («Не играл» = default state). */
function parseStatus(value: unknown): "played" | "want" | "none" | null {
  if (value !== "played" && value !== "want" && value !== "none") return null;
  return value;
}

/**
 * Set my status for a game: «Играл» (played), «Хочу поиграть» (want) or
 * «Не играл» (none — deletes the row). Ratings are untouched here; setting a
 * rating separately auto-sets status='played' (see ratings route).
 */
export async function PUT(req: Request, { params }: Params) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Не авторизован.", 401);

  if (!checkRate(`status:${me.id}`, 60, 60 * 1000)) {
    return jsonError("Слишком часто. Немного подождите.", 429);
  }

  const { gameId: rawId } = await params;
  const gameId = decodeURIComponent(rawId);
  if (!GAME_ID_RE.test(gameId)) {
    return jsonError("Некорректный идентификатор игры.", 400);
  }

  const body = await readJsonBody(req);
  if (!body) return jsonError("Некорректный запрос.", 400);

  const status = parseStatus(body.status);
  if (!status) {
    return jsonError("Статус должен быть played, want или none.", 400);
  }

  if (status === "none") {
    await db.gameStatus
      .deleteMany({ where: { userId: me.id, gameId } })
      .catch(() => undefined);
    return Response.json({ status: null });
  }

  const gameName = cleanGameName(body.game_name);
  if (!gameName) return jsonError("Некорректное название игры.", 400);
  const gameCover = cleanGameCover(body.game_cover);

  const row = await db.gameStatus.upsert({
    where: { userId_gameId: { userId: me.id, gameId } },
    create: { userId: me.id, gameId, status, gameName, gameCover },
    update: { status, gameName, gameCover },
  });

  return Response.json({
    status: {
      gameId: row.gameId,
      status: row.status as "played" | "want",
      updatedAt: row.updatedAt,
    },
  });
}
