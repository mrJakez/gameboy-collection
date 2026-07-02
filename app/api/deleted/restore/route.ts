import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/api/auth/route";
import { readDeleted, writeDeleted, createGame } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const deleted = readDeleted();
  const entry = deleted.find((d) => d.id === id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Remove from deleted list
  writeDeleted(deleted.filter((d) => d.id !== id));

  // Create a new game with the title (and romCrc if available)
  const game = createGame({
    title: entry.title,
    year: 0,
    platform: "GB",
    status: "backlog",
    cartridgeImage: null,
    libraryImage: null,
    coverImage: null,
    playtime: 0,
    notes: "",
    rating: null,
    lent: false,
    romCrc: entry.romCrc,
    pocketData: null,
    purchasePrice: null,
    createdAt: new Date().toISOString(),
    hltbPlaytimeMain: null,
    hltbPlaytimeComplete: null,
  });

  logger.action("game.restore", { gameId: game.id, title: entry.title });
  return NextResponse.json({ ok: true, gameId: game.id });
}
