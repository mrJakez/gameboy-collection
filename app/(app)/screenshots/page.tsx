"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatScreenshotDate, formatScreenshotDateTime as _fmtDT } from "@/lib/screenshot-date";

function fmtDateTime(filename: string): string | null {
  const dt = _fmtDT(filename);
  return dt ? `${dt.date} · ${dt.time}` : null;
}

interface Screenshot {
  filename: string;
  gameId: string | null;
  size: number;
  createdAt: string;
  highlight: boolean;
}

interface Game {
  id: string;
  title: string;
  platform: string;
}

type Filter = "all" | "assigned" | "unassigned" | "highlights";

interface DragRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function ScreenshotsPage() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [authenticated, setAuthenticated] = useState(false);
  const [screenshotsLoading, setScreenshotsLoading] = useState(true);
  const [lightbox, setLightbox] = useState<Screenshot | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [gameSearch, setGameSearch] = useState("");

  // Select / assign-wizard mode
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wizardGameSearch, setWizardGameSearch] = useState("");
  const [wizardAssigning, setWizardAssigning] = useState(false);

  // Rubber-band drag selection
  const thumbRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const isDraggingSelect = useRef(false);
  const [dragRect, setDragRect] = useState<DragRect | null>(null);

  const load = useCallback(() => {
    fetch("/api/screenshots").then(r => r.json()).then(d => { setScreenshots(d.screenshots ?? []); setScreenshotsLoading(false); });
  }, []);

  useEffect(() => {
    load();
    fetch("/api/auth").then(r => r.json()).then(d => setAuthenticated(d.authenticated));
    fetch("/api/public/games").then(r => r.json()).then(d =>
      setGames((d.games ?? []).sort((a: Game, b: Game) => a.title.localeCompare(b.title)))
    );
  }, [load]);

  // Keyboard nav in lightbox
  useEffect(() => {
    if (!lightbox) return;
    const visible = filtered;
    const idx = visible.findIndex(s => s.filename === lightbox.filename);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight" && idx < visible.length - 1) setLightbox(visible[idx + 1]);
      if (e.key === "ArrowLeft" && idx > 0) setLightbox(visible[idx - 1]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, filter, screenshots]);

  // Escape to exit select mode
  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitSelectMode(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectMode]);

  // Global mouse events for rubber-band drag
  useEffect(() => {
    if (!selectMode) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragStart.current || !isDraggingSelect.current) return;
      setDragRect({
        x1: Math.min(dragStart.current.x, e.clientX),
        y1: Math.min(dragStart.current.y, e.clientY),
        x2: Math.max(dragStart.current.x, e.clientX),
        y2: Math.max(dragStart.current.y, e.clientY),
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!dragStart.current || !isDraggingSelect.current) return;
      isDraggingSelect.current = false;
      const rect: DragRect = {
        x1: Math.min(dragStart.current.x, e.clientX),
        y1: Math.min(dragStart.current.y, e.clientY),
        x2: Math.max(dragStart.current.x, e.clientX),
        y2: Math.max(dragStart.current.y, e.clientY),
      };
      dragStart.current = null;
      setDragRect(null);

      // Only act when drag is large enough (not just a click)
      if (rect.x2 - rect.x1 < 5 && rect.y2 - rect.y1 < 5) return;

      const toAdd: string[] = [];
      thumbRefs.current.forEach((el, filename) => {
        const b = el.getBoundingClientRect();
        if (b.left < rect.x2 && b.right > rect.x1 && b.top < rect.y2 && b.bottom > rect.y1) {
          toAdd.push(filename);
        }
      });
      if (toAdd.length > 0) {
        setSelected(prev => {
          const next = new Set(prev);
          toAdd.forEach(f => next.add(f));
          return next;
        });
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [selectMode]);

  const filtered = screenshots.filter(s => {
    if (filter === "assigned") return s.gameId !== null;
    if (filter === "unassigned") return s.gameId === null;
    if (filter === "highlights") return s.highlight;
    return true;
  });

  function enterSelectMode() {
    setSelectMode(true);
    setSelected(new Set());
    setWizardGameSearch("");
    setFilter("unassigned");
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
    setWizardGameSearch("");
    dragStart.current = null;
    setDragRect(null);
    isDraggingSelect.current = false;
  }

  function toggleSelect(filename: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }

  async function assignSelected(gameId: string) {
    setWizardAssigning(true);
    await Promise.all(
      [...selected].map(filename =>
        fetch(`/api/screenshots/${encodeURIComponent(filename)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId }),
        })
      )
    );
    setScreenshots(prev => prev.map(s => selected.has(s.filename) ? { ...s, gameId } : s));
    setSelected(new Set());
    setWizardGameSearch("");
    setWizardAssigning(false);
  }

  async function assign(filename: string, gameId: string | null) {
    setAssigning(true);
    await fetch(`/api/screenshots/${encodeURIComponent(filename)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId }),
    });
    setScreenshots(prev => prev.map(s => s.filename === filename ? { ...s, gameId } : s));
    if (lightbox?.filename === filename) setLightbox(lb => lb ? { ...lb, gameId } : lb);
    setAssigning(false);
    setGameSearch("");
  }

  async function toggleHighlight(filename: string, highlight: boolean) {
    await fetch(`/api/screenshots/${encodeURIComponent(filename)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ highlight }),
    });
    setScreenshots(prev => prev.map(s => s.filename === filename ? { ...s, highlight } : s));
    if (lightbox?.filename === filename) setLightbox(lb => lb ? { ...lb, highlight } : lb);
  }

  async function deleteScreenshot(filename: string) {
    await fetch(`/api/screenshots/${encodeURIComponent(filename)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted: true }),
    });
    setScreenshots(prev => prev.filter(s => s.filename !== filename));
    if (lightbox?.filename === filename) setLightbox(null);
  }

  const gameForId = (id: string | null) => id ? games.find(g => g.id === id) : null;
  const filteredGames = games.filter(g =>
    !gameSearch || g.title.toLowerCase().includes(gameSearch.toLowerCase())
  );
  const wizardFilteredGames = games.filter(g =>
    !wizardGameSearch || g.title.toLowerCase().includes(wizardGameSearch.toLowerCase())
  );

  const unassigned = screenshots.filter(s => !s.gameId).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Screenshots</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {screenshots.length} screenshot{screenshots.length !== 1 ? "s" : ""}
            {unassigned > 0 && <span className="text-zinc-600"> · {unassigned} unassigned</span>}
          </p>
        </div>

        {authenticated && !selectMode && (
          <div className="flex items-center gap-2">
            <a
              href="/screenshots/duplicates"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Duplicates
            </a>
            <button
              onClick={enterSelectMode}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded-lg hover:bg-amber-900/50 transition-colors"
            >
              Assign wizard
            </button>
          </div>
        )}
      </div>

      {/* Wizard assign bar */}
      {selectMode && (
        <div className="sticky top-0 z-30 mb-4 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-xl">
          <p className="text-sm text-zinc-300 shrink-0">
            {selected.size === 0
              ? <span className="text-zinc-500">Click or drag to select screenshots</span>
              : <><span className="font-semibold text-zinc-100">{selected.size}</span> <span className="text-zinc-400">selected</span></>}
          </p>
          {selected.size > 0 && (
            <>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
              >
                Clear
              </button>
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search game to assign…"
                  value={wizardGameSearch}
                  onChange={e => setWizardGameSearch(e.target.value)}
                  disabled={wizardAssigning}
                  className="w-full h-8 px-3 bg-zinc-800 border border-amber-700/60 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
                {wizardGameSearch.length > 0 && wizardFilteredGames.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden shadow-xl max-h-60 overflow-y-auto z-40">
                    {wizardFilteredGames.slice(0, 12).map(g => (
                      <button
                        key={g.id}
                        disabled={wizardAssigning}
                        onClick={() => assignSelected(g.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
                      >
                        <span className="text-xs text-zinc-500 shrink-0 w-10">{g.platform}</span>
                        <span className="truncate">{g.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          {wizardAssigning && <span className="text-xs text-zinc-500 shrink-0">Assigning…</span>}
          <button
            onClick={exitSelectMode}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
          >
            Exit wizard
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6">
        {([
          { key: "all", label: "All" },
          { key: "unassigned", label: "Unassigned" },
          { key: "assigned", label: "Assigned" },
          { key: "highlights", label: "★ Favorites" },
        ] as { key: Filter; label: string }[]).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key
                ? f.key === "highlights" ? "bg-amber-400 text-zinc-900" : "bg-zinc-100 text-zinc-900"
                : f.key === "highlights" ? "text-amber-500 hover:text-amber-300" : "text-zinc-400 hover:text-zinc-200"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {screenshotsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-zinc-800/60 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <p className="text-4xl mb-3">📷</p>
          <p className="text-sm">{selectMode ? "No unassigned screenshots." : "No screenshots yet."}</p>
          {authenticated && !selectMode && (
            <p className="text-xs mt-2">Import from SD card or upload files above.</p>
          )}
        </div>
      ) : (
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 ${selectMode ? "select-none" : ""}`}
          onMouseDown={selectMode ? (e) => {
            if ((e.target as HTMLElement).closest("[data-thumb]")) return;
            dragStart.current = { x: e.clientX, y: e.clientY };
            isDraggingSelect.current = true;
          } : undefined}
        >
          {filtered.map(s => {
            const game = gameForId(s.gameId);
            const isSelected = selected.has(s.filename);
            return (
              <div
                key={s.filename}
                data-thumb="1"
                ref={el => {
                  if (el) thumbRefs.current.set(s.filename, el);
                  else thumbRefs.current.delete(s.filename);
                }}
                onMouseDown={selectMode ? (e) => {
                  dragStart.current = { x: e.clientX, y: e.clientY };
                  isDraggingSelect.current = true;
                } : undefined}
                onClick={selectMode
                  ? (e) => { e.stopPropagation(); toggleSelect(s.filename); }
                  : () => { setLightbox(s); setGameSearch(""); }
                }
                className={`relative group cursor-pointer rounded-lg overflow-hidden bg-zinc-900 border transition-all aspect-square ${
                  selectMode && isSelected
                    ? "border-amber-400 ring-2 ring-amber-400/40"
                    : "border-zinc-800 hover:border-zinc-600"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/screenshots/${encodeURIComponent(s.filename)}`}
                  alt={s.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  draggable={false}
                />
                {/* Bottom overlay: game name + date */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                  {game && <p className="text-[10px] text-zinc-200 truncate leading-tight">{game.title}</p>}
                  {(() => { const d = formatScreenshotDate(s.filename); return d ? <p className="text-[9px] text-zinc-400 leading-tight">{d}</p> : null; })()}
                </div>
                {/* Top-right indicators (hidden in select mode) */}
                {!selectMode && (
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                    {s.highlight && (
                      <span className="text-amber-400 leading-none" style={{ fontSize: 11, textShadow: "0 0 4px rgba(0,0,0,0.8)" }}>★</span>
                    )}
                    {!game && (
                      <div className="w-2 h-2 rounded-full bg-amber-400 opacity-80" />
                    )}
                  </div>
                )}
                {/* Selection indicator */}
                {selectMode && (
                  <>
                    <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${
                      isSelected ? "bg-amber-400 border-amber-400 text-zinc-900" : "bg-black/50 border-zinc-400/60 text-transparent"
                    }`}>
                      <CheckIcon />
                    </div>
                    {isSelected && <div className="absolute inset-0 bg-amber-400/10 pointer-events-none" />}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rubber-band selection rectangle */}
      {dragRect && (
        <div
          className="fixed pointer-events-none z-50 border border-amber-400/80 bg-amber-400/10 rounded"
          style={{
            left: dragRect.x1,
            top: dragRect.y1,
            width: dragRect.x2 - dragRect.x1,
            height: dragRect.y2 - dragRect.y1,
          }}
        />
      )}

      {/* Lightbox (hidden in select mode) */}
      {!selectMode && lightbox && (() => {
        const visible = filtered;
        const idx = visible.findIndex(s => s.filename === lightbox.filename);
        const game = gameForId(lightbox.gameId);
        return (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setLightbox(null)}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
              <div className="min-w-0">
                {fmtDateTime(lightbox.filename)
                  ? <>
                      <p className="text-sm font-semibold text-zinc-100">{fmtDateTime(lightbox.filename)}</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5 truncate">{lightbox.filename}</p>
                    </>
                  : <p className="text-xs text-zinc-400 truncate">{lightbox.filename}</p>
                }
              </div>
              <div className="flex items-center gap-1">
                {authenticated && (
                  <>
                    <button
                      onClick={() => toggleHighlight(lightbox.filename, !lightbox.highlight)}
                      className={`p-1.5 transition-colors ${lightbox.highlight ? "text-amber-400 hover:text-amber-300" : "text-zinc-600 hover:text-amber-400"}`}
                      title={lightbox.highlight ? "Remove highlight" : "Mark as highlight"}
                    >
                      <StarIcon filled={lightbox.highlight} />
                    </button>
                    <button onClick={() => deleteScreenshot(lightbox.filename)}
                      className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors">
                      <TrashIcon />
                    </button>
                  </>
                )}
                <button onClick={() => setLightbox(null)} className="p-1.5 text-zinc-400 hover:text-zinc-100 transition-colors ml-1">
                  <XIcon />
                </button>
              </div>
            </div>

            {/* Image + nav */}
            <div className="flex-1 flex items-center justify-center relative min-h-0 px-12">
              {idx > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); setLightbox(visible[idx - 1]); setGameSearch(""); }}
                  className="absolute left-2 p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  ‹
                </button>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/screenshots/${encodeURIComponent(lightbox.filename)}`}
                alt={lightbox.filename}
                className="max-h-full max-w-full object-contain rounded-sm"
                style={{ imageRendering: "pixelated", minWidth: "min(640px, 90vw)", minHeight: "min(576px, 60vh)" }}
                onClick={e => e.stopPropagation()}
              />
              {idx < visible.length - 1 && (
                <button
                  onClick={e => { e.stopPropagation(); setLightbox(visible[idx + 1]); setGameSearch(""); }}
                  className="absolute right-2 p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  ›
                </button>
              )}
            </div>

            {/* Bottom bar */}
            <div className="shrink-0 px-4 py-3 border-t border-zinc-800 flex items-center justify-between gap-4" onClick={e => e.stopPropagation()}>
              <div className="min-w-0">
                {game
                  ? <>
                      <p className="text-base font-semibold text-zinc-100 truncate">{game.title}</p>
                      <p className="text-xs text-zinc-500">{game.platform}</p>
                    </>
                  : <p className="text-sm text-zinc-600">Unassigned</p>
                }
              </div>
              <p className="text-xs text-zinc-700 shrink-0">{idx + 1} / {visible.length}</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
