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

  return NextResponse.json({
    cwd,
    dataDir,
    dataDirExists: fs.existsSync(dataDir),
    dataContents,
    dbFile,
    dbExists: fs.existsSync(dbFile),
    dbSize,
    nodeEnv: process.env.NODE_ENV ?? null,
  });
}
