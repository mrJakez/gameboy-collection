import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "data", "game_db.json");

type Platform = "GB" | "GBC" | "GBA";

function parseNoIntroXml(xml: string, platform: Platform): Record<string, { title: string; platform: Platform }> {
  const result: Record<string, { title: string; platform: Platform }> = {};

  // Match each <game name="..."> block with its <file crc32="..."/>
  const gameRegex = /<game\s+name="([^"]+)"[^>]*>[\s\S]*?<\/game>/g;
  const crcRegex = /<file\b[^>]*\bcrc32="([0-9a-fA-F]{8})"[^>]*>/;

  let match;
  while ((match = gameRegex.exec(xml)) !== null) {
    const name = match[1];
    const block = match[0];
    const crcMatch = crcRegex.exec(block);
    if (crcMatch) {
      result[crcMatch[1].toLowerCase()] = { title: name, platform };
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const platformMap: Record<string, Platform> = {
    gb: "GB",
    gbc: "GBC",
    gba: "GBA",
  };

  let combined: Record<string, { title: string; platform: Platform }> = {};
  let counts: Record<string, number> = {};

  for (const [key, platform] of Object.entries(platformMap)) {
    const file = formData.get(key) as File | null;
    if (!file) continue;

    const text = await file.text();
    const parsed = parseNoIntroXml(text, platform);
    counts[key] = Object.keys(parsed).length;
    combined = { ...combined, ...parsed };
  }

  if (Object.keys(combined).length === 0) {
    return NextResponse.json({ error: "No valid entries found in uploaded files." }, { status: 400 });
  }

  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(combined));

  return NextResponse.json({
    ok: true,
    total: Object.keys(combined).length,
    counts,
  });
}

export async function GET() {
  const exists = fs.existsSync(DB_FILE);
  return NextResponse.json({ exists });
}
