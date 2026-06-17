import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/api/auth/route";
import fs from "fs";
import path from "path";

const SCREENSHOTS_DIR = path.join(process.cwd(), "data", "screenshots");
const VOLUME_DIR = fs.existsSync("/analogue-pocket-screenshots")
  ? "/analogue-pocket-screenshots"
  : path.join(process.cwd(), "analogue-pocket-screenshots");
const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".bmp", ".gif"]);

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!fs.existsSync(VOLUME_DIR)) {
    return NextResponse.json({ error: "Volume not mounted", hint: "Mount your SD card Screenshots folder to /analogue-pocket-screenshots" }, { status: 404 });
  }

  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const existing = new Set(fs.readdirSync(SCREENSHOTS_DIR));
  const sourceFiles = fs.readdirSync(VOLUME_DIR).filter((f) => ALLOWED_EXT.has(path.extname(f).toLowerCase()));

  const imported: string[] = [];
  const skipped: string[] = [];

  for (const file of sourceFiles) {
    if (existing.has(file)) {
      skipped.push(file);
      continue;
    }
    fs.copyFileSync(path.join(VOLUME_DIR, file), path.join(SCREENSHOTS_DIR, file));
    imported.push(file);
  }

  return NextResponse.json({ imported: imported.length, skipped: skipped.length, files: imported });
}
