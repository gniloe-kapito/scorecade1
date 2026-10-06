import { getFeaturedGames } from "@/lib/steam";
import { jsonError } from "@/lib/auth";

export async function GET() {
  try {
    const items = await getFeaturedGames();
    return Response.json({ items });
  } catch {
    return jsonError("Steam временно недоступен, попробуйте позже.", 503);
  }
}
