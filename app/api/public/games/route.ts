import { NextRequest, NextResponse } from "next/server";
import { readGames } from "@/lib/db";
import type { GameStatus, Platform } from "@/lib/games";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platformFilter = searchParams.get("platform") as Platform | null;
  const statusFilter = searchParams.get("status") as GameStatus | null;
  const sort = searchParams.get("sort") ?? "title";

  let games = readGames();

  if (platformFilter) {
    games = games.filter((g) => g.platform === platformFilter);
  }
  if (statusFilter) {
    games = games.filter((g) => g.status === statusFilter);
  }

  games = games.sort((a, b) => {
    switch (sort) {
      case "playtime":
        return (b.playtime ?? 0) - (a.playtime ?? 0);
      case "rating":
        return (b.rating ?? 0) - (a.rating ?? 0);
      case "added":
        return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      default:
        return a.title.localeCompare(b.title);
    }
  });

  const payload = games.map((g) => ({
    id: g.id,
    title: g.title,
    platform: g.platform,
    year: g.year,
    status: g.status,
    rating: g.rating ?? 0,
    playtime: g.playtime ?? 0,
    notes: g.notes ?? "",
    lent: g.lent ?? false,
    purchasePrice: g.purchasePrice ?? null,
    romCrc: g.romCrc ?? null,
    createdAt: g.createdAt ?? null,
  }));

  return NextResponse.json(
    { total: payload.length, games: payload },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
