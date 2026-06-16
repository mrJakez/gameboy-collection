import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readGames } from "@/lib/db";

const SYNC_FILE = path.join(process.cwd(), "data", "last-sync.json");

export async function GET() {
  const games = readGames();

  let syncedAt: string | null = null;
  let snapshot: Record<string, number> = {};
  try {
    if (fs.existsSync(SYNC_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SYNC_FILE, "utf-8"));
      syncedAt = parsed.syncedAt ?? null;
      snapshot = parsed.snapshot ?? {};
    }
  } catch {
    // ignore
  }

  const daysAgo =
    syncedAt !== null
      ? Math.floor((Date.now() - new Date(syncedAt).getTime()) / 86_400_000)
      : null;

  const hasSnapshot = Object.keys(snapshot).length > 0;

  // Games not in snapshot but with playtime = newly synced via last Pocket Sync
  const newlyAdded = games
    .filter((g) => hasSnapshot && !(g.id in snapshot) && (g.playtime ?? 0) > 0)
    .map((g) => ({
      id: g.id,
      title: g.title,
      platform: g.platform,
      status: g.status,
      playtime: g.playtime ?? 0,
    }));

  // Games with more playtime than before the sync, sorted by delta desc
  const recentlyPlayed = games
    .map((g) => ({
      ...g,
      playtimeDelta: (g.playtime ?? 0) - (snapshot[g.id] ?? g.playtime ?? 0),
    }))
    .filter((g) => (hasSnapshot ? g.playtimeDelta > 0 : (g.playtime ?? 0) > 0))
    .sort((a, b) => (hasSnapshot ? b.playtimeDelta - a.playtimeDelta : (b.playtime ?? 0) - (a.playtime ?? 0)))
    .slice(0, 10)
    .map((g) => ({
      id: g.id,
      title: g.title,
      platform: g.platform,
      status: g.status,
      playtime: g.playtime ?? 0,
      playtimeDelta: g.playtimeDelta,
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
