import { db } from "@/lib/db";
import { getAuthUser, jsonError } from "@/lib/auth";

/** All my game statuses («Играл» / «Хочу поиграть»), one request. */
export async function GET(req: Request) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Не авторизован.", 401);

  const rows = await db.gameStatus.findMany({
    where: { userId: me.id },
    orderBy: { updatedAt: "desc" },
    select: {
      gameId: true,
      status: true,
      updatedAt: true,
    },
  });

  return Response.json({
    statuses: rows.map((r) => ({
      gameId: r.gameId,
      status: r.status as "played" | "want",
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}
