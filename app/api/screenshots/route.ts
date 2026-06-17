import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/api/auth/route";
import fs from "fs";
import path from "path";

const SCREENSHOTS_DIR = path.join(process.cwd(), "data", "screenshots");
const META_FILE = path.join(process.cwd(), "data", "screenshot-meta.json");
const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".bmp", ".gif"]);

export interface ScreenshotMeta { gameId?: string | null; deleted?: boolean; highlight?: boolean }
export function readMeta(): Record<string, ScreenshotMeta> {
  try {
    if (fs.existsSync(META_FILE)) return JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
  } catch { /* ignore */ }
  return {};
}
export function writeMeta(m: Record<string, ScreenshotMeta>) {
  fs.writeFileSync(META_FILE, JSON.stringify(m, null, 2));
}

export async function GET() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const meta = readMeta();

  const files = fs.existsSync(SCREENSHOTS_DIR)
    ? fs.readdirSync(SCREENSHOTS_DIR)
        .filter((f) => ALLOWED_EXT.has(path.extname(f).toLowerCase()) && !meta[f]?.deleted)
        .sort()
    : [];

  const screenshots = files.map((filename) => {
    const stat = fs.statSync(path.join(SCREENSHOTS_DIR, filename));
    return {
      filename,
      gameId: meta[filename]?.gameId ?? null,
      size: stat.size,
      createdAt: stat.birthtime.toISOString(),
      highlight: meta[filename]?.highlight ?? false,
    };
  });

  return NextResponse.json({ screenshots });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });

  const saved: string[] = [];
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) continue;
    const dest = path.join(SCREENSHOTS_DIR, file.name);
    fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));
    saved.push(file.name);
  }

  return NextResponse.json({ saved });
}
