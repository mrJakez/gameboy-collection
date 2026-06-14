"use client";

import { useState, useEffect, useCallback } from "react";
import { Game, STATUS_LABELS, STATUS_COLORS, PLATFORM_COLORS, formatPlaytime, GameStatus, Platform } from "@/lib/games";
import Image from "next/image";

const STATUSES: GameStatus[] = ["playing", "completed", "backlog", "wishlist"];
const PLATFORMS: Platform[] = ["GB", "GBC", "GBA", "GBP"];

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= rating ? "text-amber-400" : "text-zinc-700"} style={{ fontSize: 11 }}>★</span>
      ))}
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const statusColor = STATUS_COLORS[game.status];
  const platformColor = PLATFORM_COLORS[game.platform];

  const coverSrc = game.cartridgeImage ?? game.libraryImage ?? null;
  const isLibraryImg = !game.cartridgeImage && !!game.libraryImage;

  return (
    <a href={`/games/${game.id}`} className="group block h-full">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 hover:bg-zinc-800/60 transition-all duration-200 h-full flex flex-col">
        {/* 160×144 for library images, 3:4 portrait for cartridge photos / placeholder */}
        <div className={`bg-zinc-800 relative flex items-center justify-center overflow-hidden ${
          isLibraryImg ? "aspect-[160/144]" : "aspect-[3/4]"
        }`}>
          {coverSrc ? (
            <Image
              src={coverSrc}
              alt={game.title}
              fill
              className={isLibraryImg
                ? "object-contain group-hover:scale-105 transition-transform duration-300"
                : "object-cover group-hover:scale-105 transition-transform duration-300"}
              style={isLibraryImg ? { imageRendering: "pixelated" } : undefined}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-600">
              <span className="text-5xl">🎮</span>
              <span className="text-xs font-mono">{game.platform}</span>
            </div>
          )}
          <span className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-xs font-mono font-bold ${platformColor}`}>
            {game.platform}
          </span>
          {game.lent ? (
            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-xs border bg-orange-500/20 text-orange-300 border-orange-500/40">
              Ausgeliehen
            </span>
          ) : (
            <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-xs border ${statusColor}`}>
              {STATUS_LABELS[game.status]}
            </span>
          )}
        </div>
        <div className="p-3 space-y-1.5 flex-1 flex flex-col">
          <h3 className="font-medium text-sm text-zinc-100 leading-tight line-clamp-2 group-hover:text-white transition-colors">
            {game.title}
          </h3>
          {(game.year > 0 || game.developer) && (
            <p className="text-xs text-zinc-500">
              {[game.year > 0 ? game.year : null, game.developer || null].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="flex items-center justify-between pt-1">
            <StarRating rating={game.rating} />
            {game.playtime > 0 && (
              <span className="text-xs text-zinc-500 font-mono">{formatPlaytime(game.playtime)}</span>
            )}
            {game.playtime === 0 && game.purchasePrice && (
              <span className="text-xs text-zinc-400">{game.purchasePrice}</span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

function StatsBar({ games, statusFilter, onFilter }: { games: Game[]; statusFilter: string; onFilter: (s: string) => void }) {
  const playing = games.filter((g) => g.status === "playing").length;
  const completed = games.filter((g) => g.status === "completed").length;
  const totalHours = Math.floor(games.reduce((s, g) => s + g.playtime, 0) / 60);

  const tiles = [
    { label: "Gesamt", value: games.length, sub: "Spiele", filter: "" },
    { label: "Aktiv", value: playing, sub: "gerade gespielt", filter: "playing" },
    { label: "Durchgespielt", value: completed, sub: "abgeschlossen", filter: "completed" },
    { label: "Spielzeit", value: `${totalHours}h`, sub: "insgesamt", filter: null },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 mb-8">
      {tiles.map((stat) => {
        const clickable = stat.filter !== null;
        const active = clickable && statusFilter === stat.filter && stat.filter !== "";
        return (
          <div
            key={stat.label}
            onClick={() => clickable && onFilter(statusFilter === stat.filter ? "" : stat.filter)}
            className={`bg-zinc-900 border rounded-xl p-4 text-center transition-all ${
              clickable ? "cursor-pointer hover:bg-zinc-800/60" : ""
            } ${active ? "border-zinc-500 bg-zinc-800/60" : "border-zinc-800"}`}
          >
            <div className="text-2xl font-bold text-zinc-100">{stat.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{stat.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [lentFilter, setLentFilter] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/games").then((r) => r.json()).then(setAllGames);
  }, []);

  const fetchGames = useCallback(async () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (statusFilter) params.set("status", statusFilter);
    if (platformFilter) params.set("platform", platformFilter);
    if (lentFilter) params.set("lent", "1");
    const res = await fetch(`/api/games?${params}`);
    const data = await res.json();
    setGames(data);
    setLoading(false);
  }, [query, statusFilter, platformFilter, lentFilter]);

  useEffect(() => {
    const t = setTimeout(fetchGames, query ? 200 : 0);
    return () => clearTimeout(t);
  }, [fetchGames, query]);

  const filtered = ratingFilter > 0
    ? games.filter((g) => g.rating !== null && g.rating >= ratingFilter)
    : games;

  return (
    <div>
      <StatsBar games={allGames} statusFilter={statusFilter} onFilter={setStatusFilter} />

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Spiel, Publisher oder Genre suchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:bg-zinc-800/60 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
        >
          <option value="">Alle Status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
        >
          <option value="">Alle Systeme</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setRatingFilter(ratingFilter === s ? 0 : s)}
              className={`text-base transition-colors ${s <= ratingFilter ? "text-amber-400" : "text-zinc-700 hover:text-zinc-500"}`}
              title={`Mindestens ${s} Stern${s > 1 ? "e" : ""}`}
            >★</button>
          ))}
        </div>
        <button
          onClick={() => setLentFilter((v) => !v)}
          className={`px-3 py-2.5 rounded-lg text-sm border transition-all whitespace-nowrap ${
            lentFilter
              ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
              : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
          }`}
        >
          Ausgeliehen
        </button>
      </div>

      {!loading && (
        <p className="text-xs text-zinc-600 mb-4">
          {filtered.length} {filtered.length === 1 ? "Spiel" : "Spiele"}
          {(query || statusFilter || platformFilter || ratingFilter > 0) && " gefunden"}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 [grid-auto-rows:1fr]">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-[3/4] bg-zinc-800" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-zinc-800 rounded w-3/4" />
                <div className="h-2 bg-zinc-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <p className="text-4xl mb-3">🎮</p>
          <p className="text-sm">Keine Spiele gefunden.</p>
          {!query && !statusFilter && !platformFilter && (
            <a href="/games/new" className="mt-4 inline-block text-xs text-zinc-400 hover:text-zinc-200 underline">
              Erstes Spiel hinzufügen
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 [grid-auto-rows:1fr]">
          {filtered.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
