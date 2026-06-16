import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { isAuthenticated } from "@/app/api/auth/route";

const CACHE_FILE = path.join(process.cwd(), "data", "ai-cache.json");

function readCache(): Record<string, AiInfo> {
  if (!fs.existsSync(CACHE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")); } catch { return {}; }
}

function writeCache(cache: Record<string, AiInfo>) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export interface AiInfo {
  description: string;
  developer: string;
  publisher: string;
  genre: string;
  releaseYear: number | null;
  metacriticScore: number | null;
  userScore: number | null;
  youtubeQuery: string;
  mobySlug: string;
  wikiTitle: string;
  screenshots: string[];
  cachedAt: string;
}

async function fetchWikiScreenshots(wikiTitle: string): Promise<string[]> {
  if (!wikiTitle) return [];
  try {
    const encoded = encodeURIComponent(wikiTitle.replace(/ /g, "_"));
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/media-list/${encoded}`, {
      headers: { "User-Agent": "GameBoyCollection/1.0" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const urls: string[] = [];
    for (const item of data.items ?? []) {
      if (item.type !== "image") continue;
      const src: string = item.srcset?.[0]?.src ?? item.src ?? "";
      if (!src) continue;
      const full = src.startsWith("//") ? `https:${src}` : src;
      if (/\.(svg|ogg|ogv|webm)/i.test(full)) continue;
      if (/icon|logo|flag|map|portrait|photo|headshot/i.test(full)) continue;
      const fullSize = full.replace(/\/thumb\//, "/").replace(/\/\d+px-[^/]+$/, "");
      urls.push(fullSize);
    }
    return urls.slice(0, 4);
  } catch {
    return [];
  }
}

async function fetchDDGScreenshots(query: string): Promise<string[]> {
  try {
    const html = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" } }
    ).then((r) => r.text());

    const m = html.match(/vqd=['"]([^'"]+)['"]/);
    const vqd = m && m[1];
    if (!vqd) return [];

    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&p=1&s=0&u=bing&f=,,,,&l=wt-wt&vqd=${encodeURIComponent(vqd)}`,
      { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://duckduckgo.com/" } }
    );
    const data = await imgRes.json();
    const results: string[] = (data.results ?? [])
      .map((r: { image: string }) => r.image)
      .filter((u: string) => /\.(jpe?g|png|webp)/i.test(u))
      .slice(0, 6);
    return results;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const cache = readCache();

  // cached_only=1 → return cache entry or 404 (no AI call)
  if (req.nextUrl.searchParams.get("cached_only") === "1") {
    if (cache[id]) return NextResponse.json(cache[id]);
    return NextResponse.json(null, { status: 404 });
  }

  if (cache[id]) return NextResponse.json(cache[id]);

  const title = req.nextUrl.searchParams.get("title");
  const platform = req.nextUrl.searchParams.get("platform");
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a video game database. Return a JSON object with factual information about the requested Game Boy game. Fields:
- description: string (2–3 sentences, engaging summary of gameplay and what makes it notable)
- developer: string
- publisher: string
- genre: string (e.g. "Action-Adventure", "Platformer")
- releaseYear: number or null
- metacriticScore: number (0–100) or null (Metacritic critic score if known)
- userScore: number (0–10, one decimal) or null (Metacritic user score if known)
- youtubeQuery: string (best YouTube search query to find gameplay footage)
- mobySlug: string (MobyGames URL slug, e.g. "wario-land-super-mario-land-3")
- wikiTitle: string (exact English Wikipedia article title, e.g. "Wario Land: Super Mario Land 3")

Be accurate. If you don't know a value, return null or empty string.`,
      },
      {
        role: "user",
        content: `Game: "${title}"${platform ? ` (${platform})` : ""}. Return JSON with the fields described.`,
      },
    ],
  });

  const raw = response.choices[0].message.content ?? "{}";
  const info = JSON.parse(raw);

  const searchQuery = `${title} ${platform ?? ""} Game Boy screenshot gameplay`;
  const [wikiShots, ddgShots] = await Promise.all([
    fetchWikiScreenshots(info.wikiTitle ?? ""),
    fetchDDGScreenshots(searchQuery),
  ]);

  // Merge, deduplicate, cap at 8
  const seen = new Set<string>();
  const screenshots: string[] = [];
  for (const url of [...wikiShots, ...ddgShots]) {
    if (!seen.has(url)) { seen.add(url); screenshots.push(url); }
    if (screenshots.length >= 8) break;
  }

  const result: AiInfo = { ...info, screenshots, cachedAt: new Date().toISOString() };
  cache[id] = result;
  writeCache(cache);

  return NextResponse.json(result);
}

// Clear cache entry for a specific game (auth required)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const cache = readCache();
  if (cache[id]) {
    delete cache[id];
    writeCache(cache);
  }
  return NextResponse.json({ ok: true });
}
