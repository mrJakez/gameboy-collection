import fs from "fs";
import path from "path";
import type { Game } from "./games";

const DATA_FILE = path.join(process.cwd(), "data", "games.json");
const DELETED_FILE = path.join(process.cwd(), "data", "deleted_games.json");

export interface DeletedGame { id: string; title: string; romCrc: string | null; deletedAt: string; }

export function readDeleted(): DeletedGame[] {
  if (!fs.existsSync(DELETED_FILE)) return [];
  return JSON.parse(fs.readFileSync(DELETED_FILE, "utf-8"));
}

export function writeDeleted(list: DeletedGame[]): void {
  fs.writeFileSync(DELETED_FILE, JSON.stringify(list, null, 2));
}

let migrationDone = false;

function migrateGames(games: Game[]): Game[] {
  let dirty = false;
  const migrated = games.map((g: Game & { lastPlayed?: string | null; firstPlayed?: string | null; sessions?: number; developer?: string; publisher?: string; genre?: string[] }) => {
    const { lastPlayed, firstPlayed, sessions, developer, publisher, genre, ...rest } = g;
    if (developer !== undefined || publisher !== undefined || genre !== undefined) dirty = true;
    if (!rest.createdAt && lastPlayed) {
      rest.createdAt = lastPlayed;
      dirty = true;
    }
    if (lastPlayed !== undefined || firstPlayed !== undefined || sessions !== undefined) dirty = true;
    // Normalize purchasePrice: replace comma with period, ensure 2 decimal places
    if (rest.purchasePrice) {
      const normalized = parseFloat(String(rest.purchasePrice).replace(",", ".").replace(/[^0-9.]/g, ""));
      if (!isNaN(normalized)) {
        const fixed = normalized.toFixed(2);
        if (fixed !== rest.purchasePrice) { rest.purchasePrice = fixed; dirty = true; }
      }
    }
    return rest as Game;
  });
  if (dirty) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(migrated, null, 2));
  }
  return migrated;
}

export function readGames(): Game[] {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
    return [];
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const games = JSON.parse(raw);
  if (!migrationDone) {
    migrationDone = true;
    return migrateGames(games);
  }
  return games;
}

export function writeGames(games: Game[]): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2));
}

export function getGame(id: string): Game | undefined {
  return readGames().find((g) => g.id === id);
}

export function createGame(data: Omit<Game, "id">): Game {
  const games = readGames();
  const base = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const id = games.find((g) => g.id === base) ? `${base}-${Date.now()}` : base;
  const game: Game = { ...data, lent: data.lent ?? false, createdAt: new Date().toISOString(), id };
  games.push(game);
  writeGames(games);
  return game;
}

export function updateGame(id: string, data: Partial<Game>): Game | null {
  const games = readGames();
  const idx = games.findIndex((g) => g.id === id);
  if (idx === -1) return null;
  games[idx] = { ...games[idx], ...data };
  writeGames(games);
  return games[idx];
}

export function deleteGame(id: string): boolean {
  const games = readGames();
  const game = games.find((g) => g.id === id);
  if (!game) return false;
  writeGames(games.filter((g) => g.id !== id));
  const deleted = readDeleted();
  if (!deleted.find((d) => d.id === id)) {
    deleted.push({ id, title: game.title, romCrc: game.romCrc ?? null, deletedAt: new Date().toISOString() });
    writeDeleted(deleted);
  }
  return true;
}
