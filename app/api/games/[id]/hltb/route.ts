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

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function getSearchToken(): Promise<{ token: string; hpKey: string; hpVal: string } | null> {
  try {
    const res = await fetch(`https://howlongtobeat.com/api/bleed/init?t=${Date.now()}`, {
      headers: { "User-Agent": UA, "Referer": "https://howlongtobeat.com/" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function searchHLTB(title: string, platform: string): Promise<HLTBCandidate[]> {
  try {
    const auth = await getSearchToken();
    if (!auth) return [];

    const body: Record<string, unknown> = {
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
      useCache: true,
      [auth.hpKey]: auth.hpVal,
    };

    const res = await fetch("https://howlongtobeat.com/api/bleed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": UA,
        "Referer": "https://howlongtobeat.com/",
        "x-auth-token": auth.token,
        "x-hp-key": auth.hpKey,
        "x-hp-val": auth.hpVal,
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

async function fetchGameDetailPage(hltbId: number): Promise<{ hltbMain: number | null; hltbComplete: number | null }> {
  const empty = { hltbMain: null, hltbComplete: null };
  try {
    const html = await fetch(`https://howlongtobeat.com/game/${hltbId}`, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
    }).then(r => r.text());

    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return empty;

    const data = JSON.parse(m[1]);
    const game = data.props?.pageProps?.game?.data?.game?.[0];
    if (!game) return empty;

    return {
      hltbMain: game.comp_main ? Math.round(game.comp_main / 360) / 10 : null,
      hltbComplete: game.comp_100 ? Math.round(game.comp_100 / 360) / 10 : null,
    };
  } catch { return empty; }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already have confirmed HLTB game ID — return immediately
  if (game.hltbGameId != null && game.hltbPlaytimeMain != null) {
    return NextResponse.json({
      hltbId: game.hltbGameId,
      hltbMain: game.hltbPlaytimeMain,
      hltbComplete: game.hltbPlaytimeComplete ?? null,
    });
  }

  // Search HLTB
  const candidates = await searchHLTB(game.title, game.platform);

  if (candidates.length > 0) {
    const titleLower = game.title.toLowerCase();
    const exact = candidates.find(c => c.title.toLowerCase() === titleLower);

    if (exact) {
      // Exact match — save and return
      updateGame(id, {
        hltbPlaytimeMain: exact.hltbMain,
        hltbPlaytimeComplete: exact.hltbComplete ?? null,
        hltbGameId: exact.hltbId,
      });
      return NextResponse.json({ hltbId: exact.hltbId, hltbMain: exact.hltbMain, hltbComplete: exact.hltbComplete });
    }

    // No exact match — return candidates for user to pick
    return NextResponse.json({ candidates });
  }

  // Search failed — return existing data if available
  if (game.hltbPlaytimeMain != null) {
    return NextResponse.json({ hltbId: null, hltbMain: game.hltbPlaytimeMain, hltbComplete: game.hltbPlaytimeComplete ?? null });
  }
  return NextResponse.json({ hltbId: null, hltbMain: null, hltbComplete: null });
}

// User confirmed game ID (via candidate pick or manual URL entry)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { hltbId } = await req.json();
  if (!hltbId) return NextResponse.json({ error: "Missing hltbId" }, { status: 400 });

  // Fetch playtime from game detail page (works even when search API is blocked)
  const { hltbMain, hltbComplete } = await fetchGameDetailPage(hltbId);

  updateGame(id, {
    hltbPlaytimeMain: hltbMain,
    hltbPlaytimeComplete: hltbComplete,
    hltbGameId: hltbId,
  });

  return NextResponse.json({ hltbId, hltbMain, hltbComplete });
}
