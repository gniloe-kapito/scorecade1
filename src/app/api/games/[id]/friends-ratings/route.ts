import { db } from "@/lib/db";
import { getAuthUser, jsonError } from "@/lib/auth";

/** Ratings for this game from people I follow. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Не авторизован.", 401);

  const { id } = await params;
  const gameId = decodeURIComponent(id);

  const follows = await db.follow.findMany({
    where: { followerId: me.id },
    select: { followingId: true },
  });
  const followingIds = follows.map((f) => f.followingId);
  if (followingIds.length === 0) {
    return Response.json({ items: [] });
  }

  const ratings = await db.rating.findMany({
    where: { gameId, userId: { in: followingIds } },
    orderBy: { updatedAt: "desc" },
    include: { user: { select: { username: true, avatarUrl: true } } },
  });

  return Response.json({
    items: ratings.map((r) => ({
      username: r.user.username,
      avatarUrl: r.user.avatarUrl,
      score: r.score,
      review: r.review,
      updatedAt: r.updatedAt,
    })),
  });
}
