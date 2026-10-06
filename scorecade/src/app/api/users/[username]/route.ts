import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import type { ProfileResponse } from "@/lib/types";

function computeStats(
  ratings: Array<{ score: number }>,
): ProfileResponse["user"]["stats"] {
  const distribution = new Array(11).fill(0) as number[];
  let sum = 0;
  for (const r of ratings) {
    distribution[r.score] += 1;
    sum += r.score;
  }
  return {
    count: ratings.length,
    average: ratings.length > 0 ? Math.round((sum / ratings.length) * 10) / 10 : null,
    distribution,
  };
}

/** Public profile + all their ratings (client filters by digit). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: rawName } = await params;
  const username = decodeURIComponent(rawName);
  if (username.length < 3 || username.length > 20) {
    return Response.json({ error: "Пользователь не найден." }, { status: 404 });
  }

  const user = await db.user.findUnique({
    where: { usernameLower: username.toLowerCase() },
  });
  if (!user) {
    return Response.json({ error: "Пользователь не найден." }, { status: 404 });
  }

  const [ratings, followers, following, me, wants] = await Promise.all([
    db.rating.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        gameId: true,
        gameName: true,
        gameCover: true,
        score: true,
        review: true,
        updatedAt: true,
      },
    }),
    db.follow.count({ where: { followingId: user.id } }),
    db.follow.count({ where: { followerId: user.id } }),
    getAuthUser(req),
    db.gameStatus.findMany({
      where: { userId: user.id, status: "want" },
      orderBy: { updatedAt: "desc" },
      select: {
        gameId: true,
        gameName: true,
        gameCover: true,
        updatedAt: true,
      },
    }),
  ]);

  let isFollowing: boolean | null = null;
  if (me && me.id !== user.id) {
    const rel = await db.follow.findUnique({
      where: { followerId_followingId: { followerId: me.id, followingId: user.id } },
      select: { followerId: true },
    });
    isFollowing = rel !== null;
  }

  const response: ProfileResponse = {
    user: {
      username: user.username,
      createdAt: user.createdAt,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      stats: computeStats(ratings),
      followers,
      following,
      wants: wants.length,
      isFollowing,
    },
    ratings,
    wants,
  };
  return Response.json(response);
}
