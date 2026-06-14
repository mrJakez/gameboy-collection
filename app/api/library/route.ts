import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface LibraryEntry {
  libCrc: string;
  romCrc: string | null;
  title: string;
  platform: string;
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
  const results = q
    ? withTitles.filter((e) => e.title.toLowerCase().includes(q)).slice(0, 16)
    : withTitles.slice(0, 16);

  return NextResponse.json(results.map((e) => ({
    ...e,
    libraryImage: `/images/library/${e.libCrc}.png`,
  })));
}
