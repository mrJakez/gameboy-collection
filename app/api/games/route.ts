import { NextRequest, NextResponse } from "next/server";
import { readGames, createGame } from "@/lib/db";
import type { Game, GameStatus } from "@/lib/games";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";
  const status = searchParams.get("status") ?? "";
  const platform = searchParams.get("platform") ?? "";
  const lent = searchParams.get("lent");

  let games = readGames();

  if (q) {
    games = games.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.developer.toLowerCase().includes(q) ||
        g.publisher.toLowerCase().includes(q) ||
        g.genre.some((gen) => gen.toLowerCase().includes(q))
    );
  }
  if (status) games = games.filter((g) => g.status === (status as GameStatus));
  if (platform) games = games.filter((g) => g.platform === platform);
  if (lent === "1") games = games.filter((g) => g.lent);

  return NextResponse.json(games);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const game = createGame(body as Omit<Game, "id">);
  return NextResponse.json(game, { status: 201 });
}
