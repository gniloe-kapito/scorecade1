import { db } from "@/lib/db";

/** Users who follow the given user. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: rawName } = await params;
  const username = decodeURIComponent(rawName);

  const user = await db.user.findUnique({
    where: { usernameLower: username.toLowerCase() },
    select: { id: true },
  });
  if (!user) {
    return Response.json({ error: "Пользователь не найден." }, { status: 404 });
  }

  const follows = await db.follow.findMany({
    where: { followingId: user.id },
    orderBy: { createdAt: "desc" },
    include: { follower: { select: { username: true, avatarUrl: true } } },
  });

  return Response.json({
    items: follows.map((f) => ({
      username: f.follower.username,
      avatarUrl: f.follower.avatarUrl,
    })),
  });
}
