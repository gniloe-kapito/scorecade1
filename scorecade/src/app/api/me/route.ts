import { getAuthUser, jsonError } from "@/lib/auth";

export async function GET(req: Request) {
  const me = await getAuthUser(req);
  if (!me) return jsonError("Не авторизован.", 401);
  return Response.json({ user: me });
}
