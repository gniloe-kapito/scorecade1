import { db } from "@/lib/db";
import { getAuthUser, hashToken, jsonError } from "@/lib/auth";

export async function POST(req: Request) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Не авторизован.", 401);

  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([A-Za-z0-9]+)$/i.exec(header);
  if (match) {
    await db.session
      .delete({ where: { tokenHash: hashToken(match[1]) } })
      .catch(() => undefined);
  }
  return Response.json({ ok: true });
}
