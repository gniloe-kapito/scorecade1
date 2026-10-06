import { db } from "@/lib/db";
import { getAuthUser, jsonError } from "@/lib/auth";

type Params = { params: Promise<{ username: string }> };

async function findTarget(usernameRaw: string) {
  const username = decodeURIComponent(usernameRaw);
  return db.user.findUnique({
    where: { usernameLower: username.toLowerCase() },
  });
}

/** Follow a user. */
export async function POST(req: Request, { params }: Params) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Не авторизован.", 401);

  const { username } = await params;
  const target = await findTarget(username);
  if (!target) return jsonError("Пользователь не найден.", 404);
  if (target.id === me.id) {
    return jsonError("Нельзя подписаться на себя.", 400);
  }

  await db.follow
    .upsert({
      where: {
        followerId_followingId: { followerId: me.id, followingId: target.id },
      },
      create: { followerId: me.id, followingId: target.id },
      update: {},
    })
    .catch((err) => console.error("[follow] upsert failed:", err));

  const followers = await db.follow.count({ where: { followingId: target.id } });
  return Response.json({ ok: true, followers });
}

/** Unfollow a user. */
export async function DELETE(req: Request, { params }: Params) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Не авторизован.", 401);

  const { username } = await params;
  const target = await findTarget(username);
  if (!target) return jsonError("Пользователь не найден.", 404);

  await db.follow
    .deleteMany({ where: { followerId: me.id, followingId: target.id } })
    .catch((err) => console.error("[follow] delete failed:", err));

  const followers = await db.follow.count({ where: { followingId: target.id } });
  return Response.json({ ok: true, followers });
}
