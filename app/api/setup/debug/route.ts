import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const cwd = process.cwd();
  const dataDir = path.join(cwd, "data");
  const dbFile = path.join(dataDir, "game_db.json");

  let dataContents: string[] | null = null;
  try {
    if (fs.existsSync(dataDir)) dataContents = fs.readdirSync(dataDir);
  } catch { /* ignore */ }

  let dbSize: number | null = null;
  try {
    if (fs.existsSync(dbFile)) dbSize = fs.statSync(dbFile).size;
  } catch { /* ignore */ }

  // Simulate exactly what layout.tsx checks
  const layoutDbFile = path.join(process.cwd(), "data", "game_db.json");
  const layoutDbExists = fs.existsSync(layoutDbFile);

  let gamesFile: string | null = null;
  let gamesCount: number | null = null;
  try {
    const gf = path.join(process.cwd(), "data", "games.json");
    if (fs.existsSync(gf)) {
      const games = JSON.parse(fs.readFileSync(gf, "utf-8"));
      gamesCount = Array.isArray(games) ? games.length : null;
      gamesFile = gf;
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    cwd,
    dataDir,
    dataDirExists: fs.existsSync(dataDir),
    dataContents,
    dbFile,
    dbExists: fs.existsSync(dbFile),
    dbSize,
    layoutDbFile,
    layoutDbExists,
    layoutWouldRedirect: !layoutDbExists,
    gamesFile,
    gamesCount,
    nodeEnv: process.env.NODE_ENV ?? null,
    pid: process.pid,
  });
}
