import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LIBRARY_IMAGES_DIR =
  process.env.POCKET_LIBRARY_DIR
    ? path.join(process.env.POCKET_LIBRARY_DIR, "Images")
    : path.join(process.cwd(), "analogue-pocket-library", "Images");

function findLibCrc(romCrc: string): string | null {
  for (const platform of ["GBA", "GBC", "GB"]) {
    const p = path.join(LIBRARY_IMAGES_DIR, platform, `${romCrc}.bin`);
    if (fs.existsSync(p)) return romCrc;
  }
  return null;
}

const REGION_STRIP = [
  /\s*\((USA|Europe|Japan|World|Australia|France|Germany|Spain|Italy|Netherlands|Sweden)[^)]*\)/gi,
  /\s*\((SGB Enhanced|GB Compatible|Rev \d+|NP|En|Fr|De|Es|It|Nl|Ja|Zh|Sv|No|Da|Fi|Pt)[^)]*\)/gi,
];

function cleanTitle(title: string): string {
  return REGION_STRIP.reduce((t, re) => t.replace(re, ""), title)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}

function normalizeTitle(title: string): string {
  return cleanTitle(title).toLowerCase().replace(/\s*\([^)]*\)/g, "").trim();
}

function regionPriority(title: string): number {
  const t = title.toLowerCase();
  if (t.includes("europe") && !t.includes("japan") && !t.includes("usa")) return 0;
  if (t.includes("europe") && t.includes("usa")) return 1;
  if (t.includes("usa") || t.includes("australia")) return 2;
  if (t.includes("world")) return 3;
  if (t.includes("japan")) return 4;
  return 5;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";

  const dbPath = path.join(process.cwd(), "data", "game_db.json");
  if (!fs.existsSync(dbPath) || !q) return NextResponse.json([]);

  const db: Record<string, { title: string; platform: string; libCrc?: string }> =
    JSON.parse(fs.readFileSync(dbPath, "utf-8"));

  const matched = Object.entries(db)
    .filter(([, e]) => e.title.toLowerCase().includes(q))
    .map(([romCrc, e]) => ({ romCrc, ...e }));

  // Deduplicate by normalized title + platform, preferring best region
  const groups = new Map<string, typeof matched[number][]>();
  for (const entry of matched) {
    const key = `${normalizeTitle(entry.title)}__${entry.platform}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  const results = [];
  for (const group of groups.values()) {
    const best = group.sort((a, b) => regionPriority(a.title) - regionPriority(b.title))[0];
    const libCrc = best.libCrc ?? findLibCrc(best.romCrc);
    results.push({
      romCrc: best.romCrc,
      libCrc,
      title: cleanTitle(best.title),
      platform: best.platform,
      libraryImage: libCrc ? `/images/library/${libCrc}.png` : null,
    });
  }

  return NextResponse.json(results.slice(0, 16));
}
