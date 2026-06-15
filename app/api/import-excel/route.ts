import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/api/auth/route";
import { readGames, writeGames } from "@/lib/db";
import * as XLSX from "xlsx";

// Normalize column header → field key
function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "");
}

const KEY_MAP: Record<string, string> = {
  title: "title", titel: "title",
  platform: "platform", system: "platform", konsole: "platform",
  status: "status",
  year: "year", jahr: "year", erscheinungsjahr: "year",
  developer: "developer", entwickler: "developer",
  publisher: "publisher",
  genre: "genre",
  rating: "rating", bewertung: "rating", wertung: "rating",
  notes: "notes", notizen: "notes", anmerkungen: "notes",
  spent: "purchasePrice", price: "purchasePrice", preis: "purchasePrice",
  purchaseprice: "purchasePrice", kosten: "purchasePrice",
  added: "createdAt", hinzugefugt: "createdAt", datum: "createdAt",
};

const STATUS_MAP: Record<string, string> = {
  playing: "playing", spiele: "playing", aktiv: "playing",
  completed: "completed", abgeschlossen: "completed", fertig: "completed", done: "completed",
  backlog: "backlog", owned: "backlog", besitz: "backlog", vorhanden: "backlog",
  wishlist: "wishlist", wunschliste: "wishlist", wunsch: "wishlist",
};

const PLATFORM_MAP: Record<string, string> = {
  gb: "GB", "game boy": "GB", gameboy: "GB",
  gbc: "GBC", "game boy color": "GBC", color: "GBC",
  gba: "GBA", "game boy advance": "GBA", advance: "GBA",
};

function parseDate(val: unknown): string | null {
  if (!val) return null;
  // Excel serial date number
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return new Date(`${d.y}-${mm}-${dd}`).toISOString();
    }
  }
  const s = String(val).trim();
  // DD.MM.YYYY
  const m1 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m1) return new Date(`${m1[3]}-${m1[2].padStart(2,"0")}-${m1[1].padStart(2,"0")}`).toISOString();
  // YYYY-MM-DD
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return new Date(s).toISOString();
  return null;
}

function parsePrice(val: unknown): string | null {
  if (!val) return null;
  const num = parseFloat(String(val).replace(",", ".").replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return null;
  return num.toFixed(2);
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const confirm = formData.get("confirm") === "1";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { raw: true });

  if (rows.length === 0) return NextResponse.json({ error: "Sheet is empty" }, { status: 400 });

  // Map headers
  const sample = rows[0];
  const headerMap: Record<string, string> = {};
  for (const rawKey of Object.keys(sample)) {
    const norm = normalizeKey(rawKey);
    const mapped = KEY_MAP[norm];
    if (mapped) headerMap[rawKey] = mapped;
  }

  const existing = readGames();
  const results: { row: number; title: string; action: "added" | "updated" | "skipped"; reason?: string }[] = [];
  const toAdd: unknown[] = [];
  const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mapped: Record<string, unknown> = {};
    for (const [rawKey, field] of Object.entries(headerMap)) {
      mapped[field] = row[rawKey];
    }

    const title = String(mapped.title ?? "").trim();
    if (!title) { results.push({ row: i + 2, title: "(empty)", action: "skipped", reason: "No title" }); continue; }

    // Normalize values
    const platformRaw = String(mapped.platform ?? "").trim().toLowerCase();
    const platform = PLATFORM_MAP[platformRaw] ?? "GB";
    const statusRaw = String(mapped.status ?? "").trim().toLowerCase();
    const status = STATUS_MAP[statusRaw] ?? "backlog";
    const year = parseInt(String(mapped.year ?? "0")) || 0;
    const rating = (() => { const r = parseInt(String(mapped.rating ?? "")); return (r >= 1 && r <= 5) ? r : null; })();
    const genre = mapped.genre ? String(mapped.genre).split(/[,;]/).map((g: string) => g.trim()).filter(Boolean) : [];
    const createdAt = parseDate(mapped.createdAt);
    const purchasePrice = parsePrice(mapped.purchasePrice);

    const gameData = {
      title, platform, status, year,
      developer: String(mapped.developer ?? "").trim(),
      publisher: String(mapped.publisher ?? "").trim(),
      notes: String(mapped.notes ?? "").trim(),
      genre, rating, purchasePrice,
      createdAt: createdAt ?? new Date().toISOString(),
    };

    const found = existing.find((g) => g.title.toLowerCase() === title.toLowerCase());
    if (found) {
      toUpdate.push({ id: found.id, data: gameData });
      results.push({ row: i + 2, title, action: "updated" });
    } else {
      toAdd.push(gameData);
      results.push({ row: i + 2, title, action: "added" });
    }
  }

  if (!confirm) {
    return NextResponse.json({ preview: results, addCount: toAdd.length, updateCount: toUpdate.length });
  }

  // Actually write
  const games = readGames();
  for (const { id, data } of toUpdate) {
    const idx = games.findIndex((g) => g.id === id);
    if (idx !== -1) games[idx] = { ...games[idx], ...data };
  }
  for (const data of toAdd) {
    const d = data as Record<string, unknown>;
    const base = String(d.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const id = games.find((g) => g.id === base) ? `${base}-${Date.now()}` : base;
    games.push({
      id, lent: false, romCrc: null, pocketData: null,
      cartridgeImage: null, libraryImage: null, coverImage: null, playtime: 0,
      ...d,
    } as never);
  }
  writeGames(games);

  return NextResponse.json({ ok: true, added: toAdd.length, updated: toUpdate.length });
}
