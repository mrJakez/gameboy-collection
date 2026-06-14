import fs from "fs";
import path from "path";
import type { Game } from "./games";

const DATA_FILE = path.join(process.cwd(), "data", "games.json");

export function readGames(): Game[] {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
    return [];
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
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
  const game: Game = { ...data, lent: data.lent ?? false, id };
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
  const filtered = games.filter((g) => g.id !== id);
  if (filtered.length === games.length) return false;
  writeGames(filtered);
  return true;
}
