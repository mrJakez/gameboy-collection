"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { GameStatus, Platform, STATUS_LABELS } from "@/lib/games";

const STATUSES: GameStatus[] = ["playing", "completed", "backlog", "wishlist"];
const PLATFORMS: Platform[] = ["GB", "GBC", "GBA"];

interface LibraryEntry {
  title: string;
  romCrc: string;
  libraryImage: string | null;
}

interface ExistingGame {
  id: string;
  title: string;
  platform: string;
  status: string;
  libraryImage: string | null;
  cartridgeImage: string | null;
}

interface DeletedGame {
  id: string;
  title: string;
  romCrc: string | null;
  deletedAt: string;
}

function LibrarySearch({ onSelect }: { onSelect: (entry: LibraryEntry) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibraryEntry[]>([]);
  const [existing, setExisting] = useState<ExistingGame[]>([]);
  const [deleted, setDeleted] = useState<DeletedGame[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const justSelected = useRef(false);

  useEffect(() => {
    if (justSelected.current) { justSelected.current = false; return; }
    if (!query) { setResults([]); setExisting([]); setDeleted([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const [libRes, gamesRes, deletedRes] = await Promise.all([
        fetch(`/api/library?q=${encodeURIComponent(query)}`),
        fetch(`/api/games?q=${encodeURIComponent(query)}`),
        fetch("/api/deleted"),
      ]);
      const [libData, gamesData, deletedData] = await Promise.all([libRes.json(), gamesRes.json(), deletedRes.json()]);
      const allDeleted: DeletedGame[] = Array.isArray(deletedData) ? deletedData : [];
      const q = query.toLowerCase();
      setResults(libData);
      setExisting(Array.isArray(gamesData) ? gamesData.slice(0, 5) : []);
      setDeleted(allDeleted.filter((d) => d.title.toLowerCase().includes(q)));
      setLoading(false);
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

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
    justSelected.current = true;
    onSelect(entry);
    setQuery(entry.title);
    setOpen(false);
  }

  const hasResults = results.length > 0 || existing.length > 0 || deleted.length > 0;

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

      {open && hasResults && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
          {/* Already in collection */}
          {existing.length > 0 && (
            <>
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Already in your collection</p>
              {existing.map((game) => {
                const thumb = game.cartridgeImage ?? game.libraryImage;
                return (
                  <a
                    key={game.id}
                    href={`/games/${game.id}`}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center">
                      {thumb ? (
                        <Image src={thumb} alt={game.title} fill className="object-cover" style={{ imageRendering: "pixelated" }} />
                      ) : (
                        <span className="text-xl">🎮</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-100 truncate">{game.title}</p>
                      <p className="text-xs text-zinc-500">{game.platform} · {game.status}</p>
                    </div>
                    <span className="text-[10px] text-amber-500/80 border border-amber-500/30 rounded px-1.5 py-0.5 shrink-0">In collection</span>
                  </a>
                );
              })}
              {(results.length > 0 || deleted.length > 0) && <div className="border-t border-zinc-800 mt-1" />}
            </>
          )}

          {/* Previously deleted */}
          {deleted.length > 0 && (
            <>
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-medium text-red-500/70 uppercase tracking-wider">Previously deleted</p>
              {deleted.map((d) => (
                <div key={d.id} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg shrink-0 flex items-center justify-center">
                    <span className="text-xl">🗑</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-400 truncate">{d.title}</p>
                    <p className="text-xs text-zinc-600">Deleted · can be re-added manually</p>
                  </div>
                  <span className="text-[10px] text-red-500/60 border border-red-500/20 rounded px-1.5 py-0.5 shrink-0">Deleted</span>
                </div>
              ))}
              {results.length > 0 && <div className="border-t border-zinc-800 mt-1" />}
            </>
          )}

          {/* Pocket library results */}
          {results.length > 0 && (
            <>
              {existing.length > 0 && (
                <p className="px-3 pt-2.5 pb-1 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Pocket library</p>
              )}
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
            </>
          )}
        </div>
      )}

      {open && query.length > 0 && !hasResults && !loading && (
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
    year: 0,
    platform: "GB" as Platform,
    status: "backlog" as GameStatus,
    notes: "",
    purchasePrice: "",
    addedDate: "",
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

    let createdAt: string | null = null;
    const av = form.addedDate.trim();
    if (av) {
      const m = av.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (m) createdAt = new Date(`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`).toISOString();
    }

    const { addedDate, ...formRest } = form;
    (formRest as Record<string, unknown>).developer = "";
    (formRest as Record<string, unknown>).publisher = "";
    const payload = {
      ...formRest,
      genre: [],
      cartridgeImage: null,
      libraryImage: selectedLibEntry?.libraryImage ?? null,
      coverImage: null,
      playtime: 0,
      rating: null,
      pocketData: null,
      purchasePrice: form.purchasePrice || null,
      ...(createdAt ? { createdAt } : {}),
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
    <div className="max-w-xl mx-auto">
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
            <div className="mt-3 flex items-start gap-4">
              <div className="w-32 shrink-0 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden relative aspect-[160/144]">
                <Image
                  src={selectedLibEntry.libraryImage}
                  alt={form.title}
                  fill
                  className="object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <div className="pt-1">
                <p className="text-xs text-green-400 font-medium">Cover loaded ✓</p>
                <p className="text-xs text-zinc-500 mt-1">{selectedLibEntry.title}</p>
              </div>
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
                <label className="block text-xs text-zinc-500 mb-1.5">Year</label>
                <input
                  type="number"
                  value={form.year || ""}
                  onChange={(e) => set("year", parseInt(e.target.value) || 0)}
                  min={1989} max={2010}
                  className="w-full h-11 px-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">System</label>

                <select
                  value={form.platform}
                  onChange={(e) => set("platform", e.target.value)}
                  className="w-full h-11 px-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors appearance-none"
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
              <label className="block text-xs text-zinc-500 mb-1.5">Added (DD.MM.YYYY)</label>
              <input
                type="text"
                value={form.addedDate}
                onChange={(e) => set("addedDate", e.target.value)}
                placeholder="DD.MM.YYYY"
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Spent (€)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">€</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.purchasePrice}
                  onChange={(e) => set("purchasePrice", e.target.value)}
                  onBlur={(e) => {
                    const cleaned = e.target.value.trim().replace(/[^0-9,.-]/g, "").replace(",", ".");
                    const num = parseFloat(cleaned);
                    if (!isNaN(num)) set("purchasePrice", num.toFixed(2));
                    else if (!e.target.value.trim()) set("purchasePrice", "");
                  }}
                  className="w-full pl-7 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  placeholder="12.50"
                />
              </div>
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
