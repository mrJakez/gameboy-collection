import { NextRequest, NextResponse } from "next/server";
import { getGame, updateGame, deleteGame } from "@/lib/db";
import { isAuthenticated } from "@/app/api/auth/route";
import { logger } from "@/lib/logger";
import fs from "fs";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(game);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  // Delete the cartridge image file when it's being removed
  if (body.cartridgeImage === null) {
    const existing = getGame(id);
    if (existing?.cartridgeImage) {
      const filename = path.basename(existing.cartridgeImage);
      const filepath = path.join(process.cwd(), "data", "cartridges", filename);
      try { fs.unlinkSync(filepath); } catch { /* already gone */ }
    }
  }

  const game = updateGame(id, body);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  logger.action("game.update", { gameId: id, title: game.title, fields: Object.keys(body) });
  return NextResponse.json(game);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = getGame(id);
  const ok = deleteGame(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  logger.action("game.delete", { gameId: id, title: existing?.title });
  return NextResponse.json({ success: true });
}
