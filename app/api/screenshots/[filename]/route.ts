import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/api/auth/route";
import { readMeta, writeMeta } from "@/app/api/screenshots/route";
import fs from "fs";
import path from "path";

const SCREENSHOTS_DIR = path.join(process.cwd(), "data", "screenshots");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const filepath = path.join(SCREENSHOTS_DIR, path.basename(filename));
  if (!fs.existsSync(filepath)) return new NextResponse(null, { status: 404 });

  const ext = path.extname(filename).toLowerCase();
  const mime =
    ext === ".png" ? "image/png" :
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
    ext === ".bmp" ? "image/bmp" :
    ext === ".gif" ? "image/gif" : "application/octet-stream";

  const buf = fs.readFileSync(filepath);
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": mime, "Cache-Control": "public, max-age=3600" },
  });
}

// Assign/unassign to game, or set deleted/highlight flags
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { filename } = await params;
  const body = await req.json() as { gameId?: string | null; deleted?: boolean; highlight?: boolean };

  const meta = readMeta();
  const entry = meta[filename] ?? {};
  if ("gameId" in body) entry.gameId = body.gameId ?? null;
  if ("deleted" in body) entry.deleted = body.deleted;
  if ("highlight" in body) entry.highlight = body.highlight;
  meta[filename] = entry;
  writeMeta(meta);

  return NextResponse.json({ ok: true });
}

// Hard delete — permanently removes the file from disk
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { filename } = await params;
  const filepath = path.join(SCREENSHOTS_DIR, path.basename(filename));
  try { fs.unlinkSync(filepath); } catch { /* already gone */ }
  const meta = readMeta();
  delete meta[filename];
  writeMeta(meta);
  return NextResponse.json({ ok: true });
}
