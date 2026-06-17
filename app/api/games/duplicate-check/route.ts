import { NextRequest, NextResponse } from "next/server";
import { readGames } from "@/lib/db";
import type { Game } from "@/lib/games";
import OpenAI from "openai";

// ── Fuzzy helpers ──────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")                       // strip punctuation
    .replace(/\b(usa|eur|pal|jpn|j|e|u|gbc|gba|gb|dx|deluxe|version|edition|vol|v\d)\b/g, "") // strip common suffixes
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

export interface DuplicateMatch {
  id: string;
  title: string;
  platform: string;
  status: string;
  similarity: number;
  method: "exact" | "fuzzy" | "ai";
}

function localCheck(title: string, games: Game[]): DuplicateMatch[] {
  return games
    .map(g => ({ g, sim: similarity(title, g.title) }))
    .filter(({ sim }) => sim >= 0.72)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5)
    .map(({ g, sim }) => ({
      id: g.id,
      title: g.title,
      platform: g.platform,
      status: g.status,
      similarity: sim,
      method: sim >= 0.99 ? "exact" : "fuzzy",
    }));
}

// ── AI check ──────────────────────────────────────────────────────

async function aiCheck(title: string, platform: string, games: Game[]): Promise<DuplicateMatch[]> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const collection = games
    .map(g => `${g.id}|||${g.title}|||${g.platform}|||${g.status}`)
    .join("\n");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a Game Boy game expert. Given a game title the user wants to add, identify any likely duplicates from their collection. Consider regional variants (e.g. "Pocket Monsters" = "Pokémon"), subtitle differences, reissues, and typos. Return JSON: { "duplicates": [{ "id": "...", "reason": "short explanation" }] }. Only include genuine likely duplicates, not vague similarities. Return at most 3.`,
      },
      {
        role: "user",
        content: `New game to add: "${title}" (${platform})\n\nExisting collection:\n${collection}`,
      },
    ],
  });

  const raw = JSON.parse(response.choices[0].message.content ?? "{}") as {
    duplicates?: { id: string; reason: string }[];
  };

  if (!raw.duplicates?.length) return [];

  const idSet = new Set(raw.duplicates.map(d => d.id));
  const reasonMap = new Map(raw.duplicates.map(d => [d.id, d.reason]));

  return games
    .filter(g => idSet.has(g.id))
    .map(g => ({
      id: g.id,
      title: g.title,
      platform: g.platform,
      status: g.status,
      similarity: 1,
      method: "ai" as const,
      reason: reasonMap.get(g.id),
    }));
}

// ── Route ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title")?.trim() ?? "";
  const platform = searchParams.get("platform") ?? "";
  const useAi = searchParams.get("ai") === "1";

  if (!title || title.length < 2) return NextResponse.json({ duplicates: [], method: "local" });

  const games = readGames();

  if (useAi) {
    try {
      const duplicates = await aiCheck(title, platform, games);
      return NextResponse.json({ duplicates, method: "ai" });
    } catch (e) {
      console.error("AI duplicate check failed:", e);
      // fall through to local
    }
  }

  const duplicates = localCheck(title, games);
  return NextResponse.json({ duplicates, method: "local" });
}
