"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { GameStatus, Platform, STATUS_LABELS } from "@/lib/games";

const STATUSES: GameStatus[] = ["playing", "completed", "backlog", "wishlist"];
const PLATFORMS: Platform[] = ["GB", "GBC", "GBA", "GBP"];

interface LibraryEntry {
  title: string;
  romCrc: string;
  libraryImage: string | null;
}

function LibrarySearch({ onSelect }: { onSelect: (entry: LibraryEntry) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibraryEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query && !open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/library?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
      setOpen(true);
      setLoading(false);
    }, 150);
    return () => clearTimeout(t);
  }, [query, open]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(entry: LibraryEntry) {
    onSelect(entry);
    setQuery(entry.title);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search game title…"
          className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">…</span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
          {results.map((entry) => (
            <button
              key={entry.romCrc}
              type="button"
              onClick={() => select(entry)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center">
                {entry.libraryImage ? (
                  <Image
                    src={entry.libraryImage}
                    alt={entry.title}
                    fill
                    className="object-cover"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <span className="text-xl">🎮</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-100 truncate">{entry.title}</p>
                <p className="text-xs text-zinc-600 font-mono">{entry.romCrc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.length > 0 && results.length === 0 && !loading && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-500">
          No game found in the library.
        </div>
      )}
    </div>
  );
}

export default function NewGamePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selectedLibEntry, setSelectedLibEntry] = useState<LibraryEntry | null>(null);
  const [form, setForm] = useState({
    title: "",
    developer: "",
    publisher: "",
    year: new Date().getFullYear(),
    platform: "GB" as Platform,
    status: "backlog" as GameStatus,
    notes: "",
    purchasePrice: "",
    romCrc: null as string | null,
  });

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleLibrarySelect(entry: LibraryEntry) {
    setSelectedLibEntry(entry);
    set("title", entry.title);
    set("romCrc", entry.romCrc);
    // If we have a libraryImage, we can infer the platform (would need platform info from API)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) return;
    setSaving(true);

    const payload = {
      ...form,
      genre: [],
      cartridgeImage: null,
      libraryImage: selectedLibEntry?.libraryImage ?? null,
      coverImage: null,
      playtime: 0,
      sessions: 0,
      lastPlayed: null,
      firstPlayed: null,
      rating: null,
      pocketData: null,
      purchasePrice: form.purchasePrice || null,
    };

    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const game = await res.json();
    router.push(`/games/${game.id}`);
  }

  return (
    <div className="max-w-xl">
      <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6 inline-block">
        ← Back
      </a>
      <h2 className="text-xl font-bold text-zinc-100 mb-1">Add new game</h2>
      <p className="text-xs text-zinc-500 mb-6">Search the Pocket library or enter details manually.</p>

      <form onSubmit={submit} className="space-y-5">

        {/* Library Search */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Select from library</label>
          <LibrarySearch onSelect={handleLibrarySelect} />
          {selectedLibEntry?.libraryImage && (
            <div className="mt-2 flex items-center gap-3">
              <div className="w-16 h-12 bg-zinc-800 rounded-lg overflow-hidden relative">
                <Image
                  src={selectedLibEntry.libraryImage}
                  alt={form.title}
                  fill
                  className="object-cover"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <p className="text-xs text-green-400">Cover loaded from library ✓</p>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 pt-5">
          <p className="text-xs text-zinc-600 mb-4">Edit details / enter manually</p>

          {/* Title */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Title *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                placeholder="e.g. Pokémon Red"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Developer</label>
                <input
                  type="text"
                  value={form.developer}
                  onChange={(e) => set("developer", e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  placeholder="Game Freak"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Publisher</label>
                <input
                  type="text"
                  value={form.publisher}
                  onChange={(e) => set("publisher", e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  placeholder="Nintendo"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Year</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) => set("year", parseInt(e.target.value))}
                  min={1989} max={2010}
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">System</label>

                <select
                  value={form.platform}
                  onChange={(e) => set("platform", e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
                >
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Status</label>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("status", s)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                      form.status === s
                        ? "bg-zinc-700 text-zinc-100 border-zinc-600"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Spent</label>
              <input
                type="text"
                value={form.purchasePrice}
                onChange={(e) => set("purchasePrice", e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                placeholder="e.g. €12.50"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors resize-none"
                placeholder="Where found, observations…"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !form.title}
          className="w-full py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-sm font-medium text-zinc-100 rounded-lg transition-colors"
        >
          {saving ? "Saving…" : "Add game"}
        </button>
      </form>
    </div>
  );
}
