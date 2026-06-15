import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface LibraryEntry {
  libCrc: string;
  romCrc: string | null;
  title: string;
  platform: string;
}

function normalizeTitle(title: string): string {
  return title
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function regionPriority(title: string): number {
  const t = title.toLowerCase();
  if (t.includes("europe") && !t.includes("japan") && !t.includes("usa")) return 0;
  if (t.includes("europe") && t.includes("usa")) return 1;
  if (t.includes("usa, europe")) return 1;
  if (t.includes("usa") || t.includes("australia")) return 2;
  if (t.includes("world")) return 3;
  if (t.includes("japan")) return 4;
  return 5;
}

function deduplicateEntries(entries: LibraryEntry[]): LibraryEntry[] {
  const groups = new Map<string, LibraryEntry[]>();

  for (const entry of entries) {
    const key = `${normalizeTitle(entry.title)}__${entry.platform}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  const result: LibraryEntry[] = [];
  for (const group of groups.values()) {
    const best = group.sort((a, b) => regionPriority(a.title) - regionPriority(b.title))[0];
    result.push(best);
  }
  return result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";

  const indexPath = path.join(process.cwd(), "data", "library_index.json");
  if (!fs.existsSync(indexPath)) {
    return NextResponse.json([]);
  }

  const all: LibraryEntry[] = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  const withTitles = all.filter((e) => e.title);

  const filtered = q
    ? withTitles.filter((e) => e.title.toLowerCase().includes(q))
    : withTitles;

  const deduplicated = deduplicateEntries(filtered);

  // Clean up the displayed title (strip region tags)
  const results = deduplicated.slice(0, 16).map((e) => ({
    ...e,
    title: e.title
      .replace(/\s*\((USA|Europe|Japan|World|Australia|France|Germany|Spain|Italy|Netherlands|Sweden|Australia)[^)]*\)/gi, "")
      .replace(/\s*\((SGB Enhanced|GB Compatible|Rev \d+|NP|En|Fr|De|Es|It|Nl|Ja|Zh|Sv|No|Da|Fi|Pt)[^)]*\)/gi, "")
      .replace(/\s+/g, " ")
      .trim(),
    libraryImage: `/images/library/${e.libCrc}.png`,
  }));

  return NextResponse.json(results);
}
