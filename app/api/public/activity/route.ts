import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readGames } from "@/lib/db";

const SYNC_FILE = path.join(process.cwd(), "data", "last-sync.json");

export async function GET() {
  const games = readGames();

  let syncedAt: string | null = null;
  try {
    if (fs.existsSync(SYNC_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SYNC_FILE, "utf-8"));
      syncedAt = parsed.syncedAt ?? null;
    }
  } catch {
    // ignore
  }

  const daysAgo =
    syncedAt !== null
      ? Math.floor((Date.now() - new Date(syncedAt).getTime()) / 86_400_000)
      : null;

  const sinceSyncDate = syncedAt ? new Date(syncedAt) : null;

  // Games added since last sync (by createdAt)
  const newlyAdded = games
    .filter((g) => sinceSyncDate !== null && g.createdAt && new Date(g.createdAt) > sinceSyncDate)
    .map((g) => ({
      id: g.id,
      title: g.title,
      platform: g.platform,
      status: g.status,
      createdAt: g.createdAt,
    }));

  // Recently played = games with playtime > 0, sorted by playtime desc, top 10
  const recentlyPlayed = games
    .filter((g) => (g.playtime ?? 0) > 0)
    .sort((a, b) => (b.playtime ?? 0) - (a.playtime ?? 0))
    .slice(0, 10)
    .map((g) => ({
      id: g.id,
      title: g.title,
      platform: g.platform,
      status: g.status,
      playtime: g.playtime ?? 0,
      rating: g.rating ?? 0,
    }));

  const totalPlaytimeMin = games.reduce((sum, g) => sum + (g.playtime ?? 0), 0);

  const stats = {
    totalGames: games.length,
    totalPlaytimeMin,
    playing: games.filter((g) => g.status === "playing").length,
    completed: games.filter((g) => g.status === "completed").length,
    backlog: games.filter((g) => g.status === "backlog").length,
    wishlist: games.filter((g) => g.status === "wishlist").length,
  };

  return NextResponse.json(
    {
      lastSync: {
        syncedAt,
        daysAgo,
      },
      newlyAdded,
      recentlyPlayed,
      stats,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
