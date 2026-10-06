import { getGame } from "@/lib/steam";
import { jsonError } from "@/lib/auth";

/** Game details in the unified format. `id` looks like `steam:730`. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gameId = decodeURIComponent(id);

  try {
    const game = await getGame(gameId);
    if (!game) {
      return jsonError(
        "Игра не найдена в Steam (или это не игра — например, DLC).",
        404,
      );
    }
    return Response.json(game);
  } catch {
    return jsonError("Steam временно недоступен, попробуйте позже.", 503);
  }
}
