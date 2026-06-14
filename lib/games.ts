export type GameStatus = "playing" | "completed" | "wishlist" | "backlog";
export type Platform = "GB" | "GBC" | "GBA" | "GBP";

export interface PocketData {
  playtimeSeconds: number;
  sessions: number;
  lastPlayed: string | null;
  firstPlayed: string | null;
  saveExists: boolean;
}

export interface Game {
  id: string;
  title: string;
  developer: string;
  publisher: string;
  year: number;
  platform: Platform;
  genre: string[];
  status: GameStatus;
  cartridgeImage: string | null;  // user-uploaded cartridge photo
  libraryImage: string | null;    // auto from Analog Pocket library
  coverImage: string | null;
  playtime: number; // minutes
  sessions: number;
  lastPlayed: string | null;
  firstPlayed: string | null;
  notes: string;
  rating: number | null; // 1-5
  lent: boolean; // currently lent out to someone
  romCrc: string | null; // ROM CRC32 from Analog Pocket
  pocketData: PocketData | null;
  purchasePrice: string | null;
}

export function formatPlaytime(minutes: number): string {
  if (minutes === 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Statuses that imply physical ownership of the cartridge
export const OWNED_STATUSES: GameStatus[] = ["playing", "completed", "backlog"];

export function impliesOwnership(status: GameStatus): boolean {
  return OWNED_STATUSES.includes(status);
}

export const STATUS_LABELS: Record<GameStatus, string> = {
  playing: "Playing",
  completed: "Completed",
  wishlist: "Wishlist",
  backlog: "Owned",
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  GB: "bg-gray-700 text-gray-100",
  GBC: "bg-purple-700 text-purple-100",
  GBA: "bg-indigo-700 text-indigo-100",
  GBP: "bg-zinc-600 text-zinc-100",
};

export const STATUS_COLORS: Record<GameStatus, string> = {
  playing: "bg-green-500/20 text-green-300 border-green-500/30",
  completed: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  wishlist: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  backlog: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};
