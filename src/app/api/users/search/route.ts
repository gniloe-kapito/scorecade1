import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { checkRate, clientIp } from "@/lib/rate-limit";

const MAX_ITEMS = 8;

/**
 * User search by nickname (find friends). Case-insensitive substring match
 * with relevance ordering: exact match → starts-with → contains, then by
 * follower count. Returns isFollowing for the authenticated viewer.
 */
export async function GET(req: Request) {
  if (!checkRate(`user-search:${clientIp(req)}`, 30, 60_000)) {
    return Response.json(
      { error: "Слишком много запросов. Попробуйте позже." },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 40);
  if (q.length < 2) {
    return Response.json({ items: [] });
  }
  const lower = q.toLowerCase();

  const [candidates, me] = await Promise.all([
    db.user.findMany({
      where: { usernameLower: { contains: lower } },
      select: {
        id: true,
        username: true,
        usernameLower: true,
        avatarUrl: true,
        _count: {
          select: {
            ratings: true,
            receivedFollows: true,
          },
        },
      },
      take: 50,
    }),
    getAuthUser(req),
  ]);

  // Relevance: exact → startsWith → contains; tie-break by followers desc.
  candidates.sort((a, b) => {
    const rank = (u: typeof a) =>
      u.usernameLower === lower ? 0 : u.usernameLower.startsWith(lower) ? 1 : 2;
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return b._count.receivedFollows - a._count.receivedFollows;
  });

  const top = candidates.slice(0, MAX_ITEMS);

  // One query to resolve my follow-edges for the whole result page.
  let followingSet = new Set<number>();
  if (me && top.length > 0) {
    const edges = await db.follow.findMany({
      where: { followerId: me.id, followingId: { in: top.map((u) => u.id) } },
      select: { followingId: true },
    });
    followingSet = new Set(edges.map((e) => e.followingId));
  }

  return Response.json({
    items: top.map((u) => ({
      username: u.username,
      avatarUrl: u.avatarUrl,
      ratings: u._count.ratings,
      followers: u._count.receivedFollows,
      isFollowing: me ? followingSet.has(u.id) : null,
      isMe: me?.id === u.id,
    })),
  });
}
