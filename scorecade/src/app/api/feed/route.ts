import { db } from "@/lib/db";
import { getAuthUser, jsonError } from "@/lib/auth";
import type { FeedItem } from "@/lib/types";

const PAGE_SIZE = 20;

/** Friends' ratings feed with cursor pagination. */
export async function GET(req: Request) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Не авторизован.", 401);

  const url = new URL(req.url);
  const cursorRaw = url.searchParams.get("cursor");
  const cursor = cursorRaw && /^\d{1,16}$/.test(cursorRaw) ? Number(cursorRaw) : null;

  const follows = await db.follow.findMany({
    where: { followerId: me.id },
    select: { followingId: true },
  });
  const followingIds = follows.map((f) => f.followingId);
  if (followingIds.length === 0) {
    return Response.json({ items: [], nextCursor: null });
  }

  const rows = await db.rating.findMany({
    where: {
      userId: { in: followingIds },
      ...(cursor !== null ? { updatedAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: PAGE_SIZE + 1,
    include: { user: { select: { username: true, avatarUrl: true } } },
  });

  let nextCursor: string | null = null;
  if (rows.length > PAGE_SIZE) {
    nextCursor = String(rows[PAGE_SIZE].updatedAt.getTime());
    rows.length = PAGE_SIZE;
  }

  const items: FeedItem[] = rows.map((r) => ({
    username: r.user.username,
    avatarUrl: r.user.avatarUrl,
    gameId: r.gameId,
    gameName: r.gameName,
    gameCover: r.gameCover,
    score: r.score,
    review: r.review,
    updatedAt: r.updatedAt,
  }));

  return Response.json({ items, nextCursor });
}
