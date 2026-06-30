"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Game, STATUS_LABELS, STATUS_COLORS, PLATFORM_COLORS, formatPlaytime, GameStatus, Platform, impliesOwnership } from "@/lib/games";
import Image from "next/image";
import CartridgeSVG from "@/app/components/CartridgeSVG";
import SyncWarningBanner from "@/app/components/SyncWarningBanner";

const STATUSES: GameStatus[] = ["playing", "completed", "backlog", "wishlist"];
const PLATFORMS: Platform[] = ["GB", "GBC", "GBA"];

function formatEuro(raw: string | null | undefined): string {
  if (!raw) return "—";
  const num = parseFloat(raw.replace(",", ".").replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return raw;
  return "€ " + num.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

function GameCard({ game, urlSuffix, viewMode }: { game: Game; urlSuffix: string; viewMode: "cartridge" | "screenshot" }) {
  const statusColor = STATUS_COLORS[game.status];
  const platformColor = PLATFORM_COLORS[game.platform];

  const showCartridge = viewMode === "cartridge" && !!game.cartridgeImage;
  const showLibrary = viewMode === "screenshot" ? !!game.libraryImage : (!game.cartridgeImage && !!game.libraryImage);

  return (
    <a href={`/games/${game.id}${urlSuffix}`} className="group block h-full">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 hover:bg-zinc-800/60 transition-all duration-200 h-full flex flex-col">
        <div className="bg-zinc-900 relative flex items-center justify-center overflow-hidden aspect-[940/1064]">
          {showCartridge ? (
            <div className={`absolute inset-0 group-hover:scale-105 transition-transform duration-300 flex items-center justify-center ${game.platform === "GBA" ? "p-3" : "p-1.5"}`}>
              <CartridgeSVG platform={game.platform} labelSrc={game.cartridgeImage} className={game.platform === "GBA" ? "w-full" : "w-full h-full"} thumb />
            </div>
          ) : showLibrary ? (
            <Image
              src={game.libraryImage!}
              alt={game.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              style={{ imageRendering: "pixelated" }}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-600">
              <span className="text-5xl">🎮</span>
              <span className="text-xs font-mono">{game.platform}</span>
            </div>
          )}
          <span className={`absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-xs font-mono font-bold ${platformColor}`}>
            {game.platform}
          </span>
          {game.lent ? (
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-full text-xs border bg-orange-500/20 text-orange-300 border-orange-500/40">
              Lent out
            </span>
          ) : (
            <span className={`absolute bottom-2 right-2 px-1.5 py-0.5 rounded-full text-xs border ${statusColor}`}>
              {STATUS_LABELS[game.status]}
            </span>
          )}
        </div>
        <div className="p-3 space-y-1.5 flex-1 flex flex-col">
          <h3 className="font-medium text-sm text-zinc-100 leading-tight line-clamp-2 group-hover:text-white transition-colors">
            {game.title}
          </h3>
          {game.year > 0 && (
            <p className="text-xs text-zinc-500">{game.year}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <StarRating rating={game.rating} />
            {game.playtime > 0 && (
              <span className="text-xs text-zinc-500 font-mono">{formatPlaytime(game.playtime)}</span>
            )}
            {game.playtime === 0 && game.purchasePrice && (
              <span className="text-xs text-zinc-400">{formatEuro(game.purchasePrice)}</span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

function StatsBar({ games, statusFilter, onFilter }: { games: Game[]; statusFilter: string; onFilter: (s: string) => void }) {
  const owned = games.filter((g) => impliesOwnership(g.status)).length;
  const playing = games.filter((g) => g.status === "playing").length;
  const completed = games.filter((g) => g.status === "completed").length;
  const wishlist = games.filter((g) => g.status === "wishlist").length;

  const tiles = [
    { value: owned,     sub: "owned games",       filter: "backlog"   },
    { value: playing,   sub: "currently playing",  filter: "playing"   },
    { value: completed, sub: "finished",            filter: "completed" },
    { value: wishlist,  sub: "wishlist",            filter: "wishlist"  },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {tiles.map((stat) => {
        const active = statusFilter === stat.filter;
        return (
          <div
            key={stat.sub}
            onClick={() => onFilter(active ? "all" : stat.filter)}
            className={`bg-zinc-900 border rounded-xl p-4 text-center cursor-pointer transition-all hover:bg-zinc-800/60 ${
              active ? "border-zinc-500 bg-zinc-800/60" : "border-zinc-800"
            }`}
          >
            <div className="text-2xl font-bold text-zinc-100">{stat.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{stat.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

function HomePage() {
  const [allGames, setAllGames] = useState<Game[]>([]);
  const searchParams = useSearchParams();
  const router = useRouter();

  const query = searchParams.get("q") ?? "";
  // Default to "backlog" (owned) when no status param is set; "all" = explicit show-everything
  const statusFilter = searchParams.get("status") ?? "backlog";
  const platformFilter = searchParams.get("platform") ?? "";
  const ratingFilter = Number(searchParams.get("rating") ?? 0);
  const lentFilter = searchParams.get("lent") === "1";

  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"alpha" | "added" | "rating">(() => {
    if (typeof window === "undefined") return "alpha";
    return (localStorage.getItem("sortMode") as "alpha" | "added" | "rating") ?? "alpha";
  });
  const [viewMode, setViewMode] = useState<"cartridge" | "screenshot">(() => {
    if (typeof window === "undefined") return "cartridge";
    return (localStorage.getItem("viewMode") as "cartridge" | "screenshot") ?? "cartridge";
  });
  // inputValue is the live search text — drives filtering immediately, never reset by router
  const [inputValue, setInputValue] = useState(query);
  function updateParams(updates: Record<string, string>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    router.replace(`/?${p.toString()}`, { scroll: false });
  }

  // Debounce q to URL — pure side-effect, never reads back to avoid overwriting typed input
  useEffect(() => {
    const t = setTimeout(() => updateParams({ q: inputValue }), 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  function setStatusFilter(v: string) { updateParams({ status: v }); }
  function setPlatformFilter(v: string) { updateParams({ platform: v }); }
  function setRatingFilter(v: number) { updateParams({ rating: v > 0 ? String(v) : "" }); }
  function setLentFilter(v: boolean) { updateParams({ lent: v ? "1" : "" }); }

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((data) => { setAllGames(data); setLoading(false); });
  }, []);

  // All filtering done client-side on allGames — no network round-trip on keystroke
  const q = inputValue.toLowerCase();
  const sorted = [...allGames].filter((g) => {
    if (q && !g.title.toLowerCase().includes(q)) return false;
    if (statusFilter === "backlog") { if (!impliesOwnership(g.status)) return false; }
    else if (statusFilter && statusFilter !== "all") { if (g.status !== statusFilter) return false; }
    if (platformFilter && g.platform !== platformFilter) return false;
    if (lentFilter && !g.lent) return false;
    return true;
  }).sort((a, b) => {
    if (sortMode === "alpha") return a.title.localeCompare(b.title);
    if (sortMode === "rating") {
      const ra = a.rating ?? 0;
      const rb = b.rating ?? 0;
      return rb !== ra ? rb - ra : a.title.localeCompare(b.title);
    }
    // added: newest first, null dates go last
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const filtered = ratingFilter > 0
    ? sorted.filter((g) => g.rating !== null && g.rating >= ratingFilter)
    : sorted;


  return (
    <div>
      <StatsBar games={allGames} statusFilter={statusFilter} onFilter={setStatusFilter} />
      <SyncWarningBanner />

      <div className="flex flex-col gap-3 mb-8">
        {/* Search + mobile filter toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search game…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full pl-9 pr-8 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:bg-zinc-800/60 transition-colors"
            />
            {inputValue && (
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); setInputValue(""); }}
                className="absolute right-0 top-1/2 -translate-y-1/2 h-full px-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
              </button>
            )}
          </div>
          {/* Filter toggle — mobile only */}
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-all ${
              filtersOpen || (statusFilter && statusFilter !== "backlog") || platformFilter || ratingFilter > 0 || lentFilter
                ? "bg-zinc-700 text-zinc-100 border-zinc-600"
                : "bg-zinc-900 border-zinc-800 text-zinc-400"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6" />
            </svg>
            Filter
          </button>
        </div>

        {/* Filters — always visible on desktop, collapsible on mobile */}
        <div className={`flex flex-wrap gap-2 ${filtersOpen ? "flex" : "hidden sm:flex"}`}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 min-w-[130px] px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
          >
            <option value="">All systems</option>
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
                title={`At least ${s} star${s > 1 ? "s" : ""}`}
              >★</button>
            ))}
          </div>
          <button
            onClick={() => setLentFilter(!lentFilter)}
            className={`px-3 py-2 rounded-lg text-sm border transition-all whitespace-nowrap ${
              lentFilter
                ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            Lent out
          </button>
        </div>
      </div>

      {/* Sort + View toggle */}
      <div className="flex justify-end items-center gap-2 mb-3">
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 gap-0.5">
          {([["alpha", "A–Z"], ["added", "Recent"], ["rating", "★"]] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => { setSortMode(mode); localStorage.setItem("sortMode", mode); }}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                sortMode === mode ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 gap-0.5">
          {(["cartridge", "screenshot"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); localStorage.setItem("viewMode", mode); }}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                viewMode === mode ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {mode === "cartridge" ? "Cartridge" : "Screenshot"}
            </button>
          ))}
        </div>
      </div>

      {!loading && (
        <p className="text-xs text-zinc-600 mb-4">
          {filtered.length} {filtered.length === 1 ? "game" : "games"}
          {(query || (statusFilter && statusFilter !== "backlog") || platformFilter || ratingFilter > 0) && " found"}
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
      ) : allGames.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <p className="text-4xl mb-3">🎮</p>
          <p className="text-sm">No games found.</p>
          {!query && !statusFilter && !platformFilter && (
            <a href="/games/new" className="mt-4 inline-block text-xs text-zinc-400 hover:text-zinc-200 underline">
              Add your first game
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 [grid-auto-rows:1fr]">
          {filtered.map((game) => (
            <GameCard key={game.id} game={game} urlSuffix={searchParams.toString() ? `?back=${encodeURIComponent("/?"+searchParams.toString())}` : ""} viewMode={viewMode} />
          ))}
        </div>
      )}
    </div>
  );
}

import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense>
      <HomePage />
    </Suspense>
  );
}
