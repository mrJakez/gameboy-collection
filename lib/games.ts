export type GameStatus = "playing" | "completed" | "wishlist" | "backlog";
export type Platform = "GB" | "GBC" | "GBA" | "GBP";

export interface PocketData {
  playtimeSeconds: number;
  saveExists: boolean;
}

export interface Game {
  id: string;
  title: string;
  year: number;
  platform: Platform;
  status: GameStatus;
  cartridgeImage: string | null;  // user-uploaded cartridge photo
  libraryImage: string | null;    // auto from Analogue Pocket library
  coverImage: string | null;
  playtime: number; // minutes
  notes: string;
  rating: number | null; // 1-5
  lent: boolean; // currently lent out to someone
  romCrc: string | null; // ROM CRC32 from Analogue Pocket
  pocketData: PocketData | null;
  purchasePrice: string | null;
  createdAt: string | null;
  averagePlaytimeMain: number | null;
  averagePlaytimeComplete: number | null;
  hltbGameId?: number | null;
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
  playing: "bg-green-600 text-white border-green-500 font-semibold",
  completed: "bg-blue-600 text-white border-blue-500 font-semibold",
  wishlist: "bg-amber-500 text-white border-amber-400 font-semibold",
  backlog: "bg-emerald-600 text-white border-emerald-500 font-semibold",
};
