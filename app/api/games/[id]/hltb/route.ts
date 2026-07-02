import { NextRequest, NextResponse } from "next/server";
import { getGame, updateGame } from "@/lib/db";

export interface HLTBData {
  hltbId: number | null;
  hltbMain: number | null;
  hltbComplete: number | null;
}

export interface HLTBCandidate {
  hltbId: number;
  title: string;
  hltbMain: number | null;
  hltbComplete: number | null;
  imageUrl?: string;
}

const HLTB_PLATFORM: Record<string, string> = {
  GB: "Game Boy", GBC: "Game Boy Color", GBA: "Game Boy Advance", GBP: "Game Boy",
};

let hltbHashCache: string | null = null;

async function getHLTBHash(): Promise<string | null> {
  if (hltbHashCache) return hltbHashCache;
  try {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
    const html = await fetch("https://howlongtobeat.com", { headers: { "User-Agent": ua } }).then(r => r.text());
    const bundles = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map(m => m[1]);
    for (const src of bundles) {
      const js = await fetch(`https://howlongtobeat.com${src}`, { headers: { "User-Agent": ua } }).then(r => r.text());
      const m = js.match(/"\/api\/search\/([a-zA-Z0-9]+)"/);
      if (m) { hltbHashCache = m[1]; return hltbHashCache; }
    }
  } catch { /* ignore */ }
  return null;
}

async function searchHLTB(title: string, platform: string): Promise<HLTBCandidate[]> {
  try {
    const hash = await getHLTBHash();
    const url = hash
      ? `https://howlongtobeat.com/api/search/${hash}`
      : "https://howlongtobeat.com/api/search";

    const body = {
      searchType: "games",
      searchTerms: title.split(/\s+/),
      searchPage: 1,
      size: 10,
      searchOptions: {
        games: {
          userId: 0, platform: HLTB_PLATFORM[platform] ?? "Game Boy",
          sortCategory: "popular", rangeCategory: "main",
          rangeTime: { min: null, max: null },
          gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
          rangeYear: { min: "", max: "" }, modifier: "",
        },
        users: { sortCategory: "postcount" },
        lists: { sortCategory: "follows" },
        filter: "", sort: 0, randomizer: 0,
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://howlongtobeat.com/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const results: { game_id: number; game_name: string; comp_main: number; comp_100: number; game_image?: string }[] = data.data ?? [];

    return results.map(r => ({
      hltbId: r.game_id,
      title: r.game_name,
      hltbMain: r.comp_main ? Math.round(r.comp_main / 360) / 10 : null,
      hltbComplete: r.comp_100 ? Math.round(r.comp_100 / 360) / 10 : null,
      imageUrl: r.game_image ? `https://howlongtobeat.com/games/${r.game_image}` : undefined,
    }));
  } catch { return []; }
}


export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already have confirmed HLTB game ID — return immediately
  if (game.hltbGameId != null && game.averagePlaytimeMain != null) {
    return NextResponse.json({
      hltbId: game.hltbGameId,
      hltbMain: game.averagePlaytimeMain,
      hltbComplete: game.averagePlaytimeComplete ?? null,
    });
  }

  // Search HLTB (also runs when we have playtime from AI but no hltbGameId yet)
  const candidates = await searchHLTB(game.title, game.platform);

  if (candidates.length > 0) {
    const titleLower = game.title.toLowerCase();
    const exact = candidates.find(c => c.title.toLowerCase() === titleLower);

    if (exact) {
      // Exact match — save and return
      updateGame(id, {
        averagePlaytimeMain: exact.hltbMain,
        averagePlaytimeComplete: exact.hltbComplete ?? null,
        hltbGameId: exact.hltbId,
      });
      return NextResponse.json({ hltbId: exact.hltbId, hltbMain: exact.hltbMain, hltbComplete: exact.hltbComplete });
    }

    // No exact match — return candidates for user to pick
    return NextResponse.json({ candidates });
  }

  // HLTB blocked — return existing data if available, otherwise nothing
  if (game.averagePlaytimeMain != null) {
    return NextResponse.json({ hltbId: null, hltbMain: game.averagePlaytimeMain, hltbComplete: game.averagePlaytimeComplete ?? null });
  }
  return NextResponse.json({ hltbId: null, hltbMain: null, hltbComplete: null });
}

// User confirmed a candidate selection
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { hltbId } = await req.json();
  if (!hltbId) return NextResponse.json({ error: "Missing hltbId" }, { status: 400 });

  // Find the confirmed candidate's data from a fresh search
  const candidates = await searchHLTB(game.title, game.platform);
  const pick = candidates.find(c => c.hltbId === hltbId);

  const hltbMain = pick?.hltbMain ?? null;
  const hltbComplete = pick?.hltbComplete ?? null;

  updateGame(id, {
    averagePlaytimeMain: hltbMain,
    averagePlaytimeComplete: hltbComplete,
    hltbGameId: hltbId,
  });

  return NextResponse.json({ hltbId, hltbMain, hltbComplete });
}
