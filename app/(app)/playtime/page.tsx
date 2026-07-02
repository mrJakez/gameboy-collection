"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Game, STATUS_COLORS, STATUS_LABELS, PLATFORM_COLORS, formatPlaytime } from "@/lib/games";

type SortKey = "playtime" | "title" | "platform";

function fmtMins(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function PlaytimeRow({ game, maxPlaytime, rank }: { game: Game; maxPlaytime: number; rank: number }) {
  const rawSrc = game.cartridgeImage ?? game.libraryImage;
  const coverSrc = rawSrc?.includes("/images/cartridges/") ? `${rawSrc}?thumb=1` : rawSrc;
  const platformColor = PLATFORM_COLORS[game.platform];
  const statusColor = STATUS_COLORS[game.status];

  const hasHltb = game.hltbPlaytimeMain != null;
  const actualMins = game.playtime;
  const avgMins = hasHltb ? Math.round(game.hltbPlaytimeMain! * 60) : 0;
  const completed = game.status === "completed";
  const playing = game.status === "playing";
  const pct = hasHltb ? Math.min(actualMins / avgMins, 1) : actualMins / Math.max(maxPlaytime, 1);
  const barColor = !hasHltb ? "bg-zinc-600" : completed ? "bg-blue-500" : playing ? "bg-green-500" : "bg-zinc-500";

  return (
    <a href={`/games/${game.id}?from=playtime`} className="group flex items-center gap-4 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/60 transition-all">
      {/* Rank */}
      <span className="text-zinc-600 text-xs font-mono w-6 text-right shrink-0">{rank}</span>

      {/* Cover thumbnail */}
      <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden shrink-0 relative">
        {coverSrc ? (
          <Image src={coverSrc} alt={game.title} fill className="object-cover" style={{ imageRendering: "pixelated" }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700 text-lg">🎮</div>
        )}
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-white transition-colors">{game.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs font-mono px-1 rounded ${platformColor}`}>{game.platform}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${statusColor}`}>{STATUS_LABELS[game.status]}</span>
        </div>
      </div>

      {/* Bar + time */}
      <div className="hidden sm:flex flex-col gap-1 shrink-0 w-48">
        <div className="flex justify-between items-baseline text-[10px] text-zinc-500">
          <span>{fmtMins(actualMins)}</span>
          {hasHltb && <span className="text-zinc-600">~{fmtMins(avgMins)} avg</span>}
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      </div>

      {/* Mobile time */}
      <span className="sm:hidden text-sm font-mono text-zinc-300 shrink-0">{formatPlaytime(game.playtime)}</span>
    </a>
  );
}

function TotalStats({ games }: { games: Game[] }) {
  const played = games.filter((g) => g.playtime > 0);
  const totalMins = games.reduce((s, g) => s + g.playtime, 0);
  const totalHours = Math.floor(totalMins / 60);
  const avgMins = played.length ? Math.floor(totalMins / played.length) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {[
        { label: "Total play time", value: `${totalHours}h` },
        { label: "Played titles", value: played.length },
        { label: "Avg per game", value: formatPlaytime(avgMins) },
        { label: "10h+ games", value: games.filter((g) => g.playtime >= 600).length + " titles" },
      ].map((s) => (
        <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-zinc-100">{s.value}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-4 h-4 rounded-full border border-zinc-600 hover:border-zinc-400 text-zinc-500 hover:text-zinc-300 transition-colors text-[10px] font-bold flex items-center justify-center"
        title="Legend"
      >
        ?
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-10 w-64 bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-xl text-xs text-zinc-400 space-y-2">
          <p className="font-semibold text-zinc-200 mb-1">Progress bar</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-1.5 rounded-full bg-green-500 shrink-0" />
            <span>Currently playing — bar shows progress vs. HowLongToBeat average</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span>Completed — bar shows how far you got vs. HowLongToBeat average</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-1.5 rounded-full bg-zinc-600 shrink-0" />
            <span>No HowLongToBeat data — bar shows time relative to longest played game</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlaytimePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("playtime");
  const [sortAsc, setSortAsc] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("playtime_hideCompleted") === "1"
  );
  const [loading, setLoading] = useState(true);

  function toggleHideCompleted() {
    setHideCompleted((v) => {
      const next = !v;
      localStorage.setItem("playtime_hideCompleted", next ? "1" : "0");
      return next;
    });
  }

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((data) => { setGames(data); setLoading(false); });
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  const sorted = [...games]
    .filter((g) => g.playtime > 0)
    .filter((g) => !hideCompleted || g.status !== "completed")
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "playtime") cmp = a.playtime - b.playtime;
      else if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "platform") cmp = a.platform.localeCompare(b.platform);
      return sortAsc ? cmp : -cmp;
    });

  const maxPlaytime = Math.max(...sorted.map((g) => g.playtime), 1);

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
          active
            ? "bg-zinc-700 text-zinc-100 border-zinc-600"
            : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
        }`}
      >
        {label} {active ? (sortAsc ? "↑" : "↓") : ""}
      </button>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Play Time</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-zinc-500">All titles sorted by time on the Analogue Pocket</p>
            <Legend />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Collection</a>
        </div>
      </div>

      {!loading && <TotalStats games={games} />}

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap justify-between sm:justify-start">
        <span className="text-xs text-zinc-600">Sort:</span>
        <SortBtn k="playtime" label="Play time" />
        <SortBtn k="title" label="Name" />
        <SortBtn k="platform" label="System" />
        <div className="ml-auto">
          <button
            onClick={toggleHideCompleted}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
              hideCompleted
                ? "bg-zinc-700 text-zinc-100 border-zinc-600"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
            }`}
          >
            {hideCompleted ? "Show completed" : "Hide completed"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <p className="text-4xl mb-3">⏱</p>
          <p className="text-sm">No play time recorded yet.</p>
          <p className="text-xs mt-2">Import your Analogue Pocket data.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((game, i) => (
            <PlaytimeRow key={game.id} game={game} maxPlaytime={maxPlaytime} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
