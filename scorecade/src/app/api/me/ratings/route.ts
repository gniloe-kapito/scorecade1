import { db } from "@/lib/db";
import { getAuthUser, jsonError } from "@/lib/auth";

/** All of my ratings in a single request (used by the wheel + same-score carousel). */
export async function GET(req: Request) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Не авторизован.", 401);

  const ratings = await db.rating.findMany({
    where: { userId: me.id },
    orderBy: { updatedAt: "desc" },
    select: {
      gameId: true,
      gameName: true,
      gameCover: true,
      score: true,
      review: true,
      updatedAt: true,
    },
  });

  return Response.json({ ratings });
}
