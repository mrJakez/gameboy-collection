import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getGame, updateGame } from "@/lib/db";

export interface HLTBData {
  hltbId: number | null;
  hltbMain: number | null;
  hltbComplete: number | null;
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

async function fetchFromHLTB(title: string, platform: string): Promise<HLTBData> {
  const empty: HLTBData = { hltbId: null, hltbMain: null, hltbComplete: null };
  try {
    const hash = await getHLTBHash();
    const url = hash
      ? `https://howlongtobeat.com/api/search/${hash}`
      : "https://howlongtobeat.com/api/search";

    const body = {
      searchType: "games",
      searchTerms: title.split(/\s+/),
      searchPage: 1,
      size: 20,
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
    if (!res.ok) return empty;

    const data = await res.json();
    const results: { game_id: number; game_name: string; comp_main: number; comp_100: number }[] = data.data ?? [];
    if (!results.length) return empty;

    const titleLower = title.toLowerCase();
    const hit = results.find(r => r.game_name.toLowerCase() === titleLower) ?? results[0];
    return {
      hltbId: hit.game_id,
      hltbMain: hit.comp_main ? Math.round(hit.comp_main / 360) / 10 : null,
      hltbComplete: hit.comp_100 ? Math.round(hit.comp_100 / 360) / 10 : null,
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

  // Return from game record if already stored
  if (game.averagePlaytimeMain != null) {
    return NextResponse.json({
      hltbId: null,
      hltbMain: game.averagePlaytimeMain,
      hltbComplete: game.averagePlaytimeComplete ?? null,
    });
  }

  // Try fetching from HLTB
  const result = await fetchFromHLTB(game.title, game.platform);

  // Persist to game record if we got data
  if (result.hltbMain != null) {
    updateGame(id, {
      averagePlaytimeMain: result.hltbMain,
      averagePlaytimeComplete: result.hltbComplete,
    });
    return NextResponse.json(result);
  }

  // Fallback: ask OpenAI just for playtime estimates
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a video game database. Return a JSON object with average playtime for the requested Game Boy game.
Fields:
- averagePlaytimeMain: number or null (average hours to beat the main story, as a decimal like 6.5)
- averagePlaytimeComplete: number or null (average hours for 100% completion)
Be accurate. Return null if you don't know.`,
        },
        {
          role: "user",
          content: `Game: "${game.title}" (${game.platform})`,
        },
      ],
    });
    const info = JSON.parse(response.choices[0].message.content ?? "{}");
    if (info.averagePlaytimeMain != null) {
      updateGame(id, {
        averagePlaytimeMain: info.averagePlaytimeMain,
        averagePlaytimeComplete: info.averagePlaytimeComplete ?? null,
      });
      return NextResponse.json({ hltbId: null, hltbMain: info.averagePlaytimeMain, hltbComplete: info.averagePlaytimeComplete ?? null });
    }
  } catch { /* ignore */ }

  return NextResponse.json({ hltbId: null, hltbMain: null, hltbComplete: null });
}
