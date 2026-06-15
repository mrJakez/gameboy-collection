"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Game, STATUS_COLORS, STATUS_LABELS, PLATFORM_COLORS, formatPlaytime } from "@/lib/games";

type SortKey = "playtime" | "title" | "platform";

function BarChart({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-zinc-500 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PlaytimeRow({ game, maxPlaytime, rank }: { game: Game; maxPlaytime: number; rank: number }) {
  const coverSrc = game.cartridgeImage ?? game.libraryImage;
  const platformColor = PLATFORM_COLORS[game.platform];
  const statusColor = STATUS_COLORS[game.status];

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
      <div className="flex items-center gap-3 shrink-0 sm:w-48">
        <div className="hidden sm:block flex-1">
          <BarChart value={game.playtime} max={maxPlaytime} />
        </div>
        <span className="text-sm font-mono text-zinc-300 w-14 text-right">{formatPlaytime(game.playtime)}</span>
      </div>
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
          <p className="text-xs text-zinc-500 mt-0.5">All titles sorted by time on the Analog Pocket</p>
        </div>
        <div className="flex items-center gap-2">
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
          <p className="text-xs mt-2">Import your Analog Pocket data.</p>
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
