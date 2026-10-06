import { db } from "@/lib/db";
import { getAuthUser, jsonError } from "@/lib/auth";
import { GAME_ID_RE } from "@/lib/validate";

const PAGE_SIZE = 20;

/**
 * Community ratings for a game: aggregate stats (count / average /
 * distribution) + recent ratings from ALL users with cursor pagination.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gameId = decodeURIComponent(id);
  if (!GAME_ID_RE.test(gameId)) {
    return jsonError("Некорректный идентификатор игры.", 400);
  }

  const url = new URL(req.url);
  const cursorRaw = url.searchParams.get("cursor");
  const cursor =
    cursorRaw && /^\d{1,16}$/.test(cursorRaw) ? Number(cursorRaw) : null;

  const me = await getAuthUser(req);

  // Aggregate distribution via groupBy (no need to fetch every row)
  const groups = await db.rating.groupBy({
    by: ["score"],
    where: { gameId },
    _count: { _all: true },
  });
  const distribution = new Array(11).fill(0) as number[];
  let count = 0;
  let sum = 0;
  for (const g of groups) {
    distribution[g.score] = g._count._all;
    count += g._count._all;
    sum += g.score * g._count._all;
  }

  // How many users marked this game as «Хочу поиграть»
  const wants = await db.gameStatus.count({
    where: { gameId, status: "want" },
  });

  const rows = await db.rating.findMany({
    where: {
      gameId,
      ...(cursor !== null ? { updatedAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: PAGE_SIZE + 1,
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
  });

  let nextCursor: string | null = null;
  if (rows.length > PAGE_SIZE) {
    nextCursor = String(rows[PAGE_SIZE].updatedAt.getTime());
    rows.length = PAGE_SIZE;
  }

  // One query to mark which raters I follow (for the «в друзьях» badge).
  let friendIds = new Set<number>();
  if (me && rows.length > 0) {
    const edges = await db.follow.findMany({
      where: {
        followerId: me.id,
        followingId: { in: rows.map((r) => r.user.id) },
      },
      select: { followingId: true },
    });
    friendIds = new Set(edges.map((e) => e.followingId));
  }

  return Response.json({
    stats: {
      count,
      average: count > 0 ? Math.round((sum / count) * 10) / 10 : null,
      distribution,
      wants,
    },
    items: rows.map((r) => ({
      username: r.user.username,
      avatarUrl: r.user.avatarUrl,
      score: r.score,
      review: r.review,
      updatedAt: r.updatedAt.toISOString(),
      isFriend: me ? friendIds.has(r.user.id) : false,
    })),
    nextCursor,
  });
}
