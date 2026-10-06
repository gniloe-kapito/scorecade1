import { db } from "@/lib/db";

/**
 * Top games by community ratings: rank by average score (games with 2+
 * ratings first), fill with single-rating games, limit 12. Names/covers come
 * from the denormalized rating rows, so no Steam calls are needed.
 */
export async function GET() {
  const groups = await db.rating.groupBy({
    by: ["gameId"],
    _count: { _all: true },
    _avg: { score: true },
  });

  const flat = groups.map((g) => ({
    gameId: g.gameId,
    count: g._count._all,
    average: Math.round((g._avg.score ?? 0) * 10) / 10,
  }));

  const ranked = [
    ...flat.filter((g) => g.count >= 2).sort((a, b) => b.average - a.average || b.count - a.count),
    ...flat.filter((g) => g.count === 1).sort((a, b) => b.average - a.average),
  ];

  const top = ranked.slice(0, 12);
  const items = await Promise.all(
    top.map(async (t) => {
      const row = await db.rating.findFirst({
        where: { gameId: t.gameId },
        orderBy: { updatedAt: "desc" },
        select: { gameName: true, gameCover: true },
      });
      return {
        gameId: t.gameId,
        gameName: row?.gameName ?? t.gameId,
        gameCover: row?.gameCover ?? null,
        count: t.count,
        average: t.average,
      };
    }),
  );

  return Response.json({ items });
}
