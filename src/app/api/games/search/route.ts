import { searchGames } from "@/lib/steam";
import { UpstreamError } from "@/lib/cache";
import { jsonError } from "@/lib/auth";
import { checkRate, clientIp } from "@/lib/rate-limit";

export async function GET(req: Request) {
  if (!checkRate(`search:${clientIp(req)}`, 30, 60 * 1000)) {
    return jsonError("Слишком много поисковых запросов. Попробуйте через минуту.", 429);
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return Response.json({ items: [] });
  }
  if (q.length > 64) {
    return jsonError("Слишком длинный поисковый запрос.", 400);
  }

  try {
    const items = await searchGames(q);
    return Response.json({ items });
  } catch (err) {
    if (err instanceof UpstreamError || err instanceof Error) {
      return jsonError("Steam временно недоступен, попробуйте позже.", 503);
    }
    return jsonError("Steam временно недоступен, попробуйте позже.", 503);
  }
}
