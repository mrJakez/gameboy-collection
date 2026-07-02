"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import CartridgeSVG from "@/app/components/CartridgeSVG";
import CropEditor, { type Box } from "@/app/components/CropEditor";
import { formatScreenshotDateTime } from "@/lib/screenshot-date";
import LightboxOverlay from "@/app/components/LightboxOverlay";
import {
  Game,
  STATUS_LABELS,
  STATUS_COLORS,
  PLATFORM_COLORS,
  formatPlaytime,
  GameStatus,
  Platform,
  OWNED_STATUSES,
} from "@/lib/games";

const STATUSES: GameStatus[] = ["playing", "completed", "backlog", "wishlist"];

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
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
const PLATFORMS: Platform[] = ["GB", "GBC", "GBA"];

function StatBox({ label, value, onClick, active }: { label: string; value: string | number; onClick?: () => void; active?: boolean }) {
  const base = "bg-zinc-900 border rounded-xl p-4 transition-all";
  const cls = onClick
    ? `${base} cursor-pointer hover:bg-zinc-800/60 ${active ? "border-orange-500/40 bg-orange-500/10" : "border-zinc-800"}`
    : `${base} border-zinc-800`;
  return (
    <div className={cls} onClick={onClick}>
      <div className="text-xl font-bold text-zinc-100">{value}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}

function formatEuro(raw: string | null | undefined): string {
  if (!raw) return "—";
  const num = parseFloat(raw.replace(",", ".").replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return raw;
  return "€ " + num.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizePrice(input: string): string | null {
  const cleaned = input.trim().replace(/[^0-9,.-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return num.toFixed(2);
}

function StarRatingInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(null)}
          className="text-xl transition-colors"
        >
          <span className={(hovered ?? value ?? 0) >= s ? "text-amber-400" : "text-zinc-700"}>★</span>
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full h-10 px-3 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = `${inputCls} appearance-none`;

const URL_RE = /https?:\/\/[^\s<>"]+/g;

function renderNotes(text: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    const url = m[0];
    parts.push(
      <a key={m.index} href={url} target="_blank" rel="noopener noreferrer"
        className="text-blue-400 underline hover:text-blue-300 break-all">
        {url}
      </a>
    );
    last = m.index! + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [backHref, setBackHref] = useState("/");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const back = sp.get("back");
    if (back) {
      setBackHref(decodeURIComponent(back));
    } else if (sp.get("from") === "playtime") {
      setBackHref("/playtime");
    }
  }, []);
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [screenshots, setScreenshots] = useState<{ filename: string; gameId: string | null; highlight: boolean }[]>([]);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [imageLightbox, setImageLightbox] = useState<string | null>(null);
  const [cartridgeLightbox, setCartridgeLightbox] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingLabel, setProcessingLabel] = useState(false);
  const [imageView, setImageView] = useState<"cartridge" | "cover">("cartridge");
  const [variants, setVariants] = useState<{ key: string; label: string; path: string }[] | null>(null);
  const [origImg, setOrigImg] = useState<string | null>(null);
  const [detectedBox, setDetectedBox] = useState<Box | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [form, setForm] = useState<Partial<Game>>({});
  const [hltb, setHltb] = useState<{ hltbId: number | null; hltbMain: number | null; hltbComplete: number | null } | null>(null);
  const [hltbLoading, setHltbLoading] = useState(true);
  const [hltbCandidates, setHltbCandidates] = useState<{ hltbId: number; title: string; hltbMain: number | null; hltbComplete: number | null }[] | null>(null);
  const [hltbLinkEditing, setHltbLinkEditing] = useState(false);
  const [hltbLinkInput, setHltbLinkInput] = useState("");

  // Auto-fetch HLTB data on mount — independent of AI info
  useEffect(() => {
    setHltbLoading(true);
    setHltbCandidates(null);
    fetch(`/api/games/${id}/hltb`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        if (data.candidates) {
          setHltbCandidates(data.candidates);
        } else {
          setHltb(data);
        }
      })
      .catch(() => {})
      .finally(() => setHltbLoading(false));
  }, [id]);

  async function confirmHltbCandidate(hltbId: number) {
    setHltbLoading(true);
    setHltbCandidates(null);
    try {
      const res = await fetch(`/api/games/${id}/hltb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hltbId }),
      });
      if (res.ok) setHltb(await res.json());
    } finally {
      setHltbLoading(false);
    }
  }

  async function saveHltbLink() {
    const m = hltbLinkInput.match(/howlongtobeat\.com\/game\/(\d+)/);
    if (!m) return;
    const hltbId = parseInt(m[1], 10);
    setHltbLinkEditing(false);
    setHltbLinkInput("");
    await confirmHltbCandidate(hltbId);
  }

  async function toggleHighlight(filename: string, highlight: boolean) {
    await fetch(`/api/screenshots/${encodeURIComponent(filename)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ highlight }),
    });
    setScreenshots(prev => prev.map(s => s.filename === filename ? { ...s, highlight } : s));
  }

  async function deleteScreenshot(filename: string) {
    await fetch(`/api/screenshots/${encodeURIComponent(filename)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted: true }),
    });
    setScreenshots(prev => prev.filter(s => s.filename !== filename));
    setLightboxImg(null);
  }

  const checkAuth = useCallback(async () => {
    const r = await fetch("/api/auth");
    const d = await r.json();
    setAuthenticated(d.authenticated);
  }, []);

  useEffect(() => {
    fetch(`/api/games/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setGame(data);
        setLoading(false);
        if (!data.cartridgeImage && data.libraryImage) setImageView("cover");
      });
    fetch("/api/screenshots")
      .then(r => r.json())
      .then(d => setScreenshots(d.screenshots ?? []));
    checkAuth();
  }, [id, checkAuth]);

  function startEdit() {
    if (!game) return;
    setForm({
      title: game.title,
      year: game.year,
      platform: game.platform,
      notes: game.notes,
      purchasePrice: game.purchasePrice ?? "",
      createdAt: game.createdAt ? (() => { const d = new Date(game.createdAt!); const dd = String(d.getDate()).padStart(2,"0"); const mm = String(d.getMonth()+1).padStart(2,"0"); return `${dd}.${mm}.${d.getFullYear()}`; })() : "",
    });
    setEditing(true);
  }

  function set(key: keyof Game, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function patch(updates: Partial<Game>) {
    const res = await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return null;
    const updated = await res.json();
    setGame(updated);
    return updated;
  }

  async function saveEdit() {
    setSaving(true);
    const createdAtRaw = form.createdAt as string;
    let createdAt: string | null = null;
    if (createdAtRaw) {
      const mDE = createdAtRaw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      const mISO = createdAtRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (mDE) createdAt = new Date(`${mDE[3]}-${mDE[2].padStart(2,"0")}-${mDE[1].padStart(2,"0")}`).toISOString();
      else if (mISO) createdAt = new Date(createdAtRaw).toISOString();
      else createdAt = game?.createdAt ?? null;
    }
    await patch({ ...form, purchasePrice: (form.purchasePrice as string) || null, createdAt });
    setSaving(false);
    setEditing(false);
  }

  async function deleteCartridgeImage() {
    await patch({ cartridgeImage: null });
  }

  function closeChooser() {
    setVariants(null);
    setOrigImg(null);
    setDetectedBox(null);
    setManualMode(false);
  }

  async function uploadCartridgePhoto(file: File) {
    setProcessingLabel(true);
    closeChooser();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("gameId", game?.romCrc ?? id);
    const res = await fetch("/api/process-cartridge", { method: "POST", body: fd });
    const data = await res.json();
    setProcessingLabel(false);
    if (data.variants?.length) {
      setVariants(data.variants);
      setOrigImg(data.original ?? null);
      setDetectedBox(data.bbox ?? null);
      setImageView("cartridge");
    } else {
      alert(data.error ?? "Processing failed");
    }
  }

  async function chooseVariant(variantPath: string) {
    setProcessingLabel(true);
    const fd = new FormData();
    fd.append("select", variantPath);
    fd.append("gameId", game?.romCrc ?? id);
    const res = await fetch("/api/process-cartridge", { method: "POST", body: fd });
    const data = await res.json();
    setProcessingLabel(false);
    closeChooser();
    if (data.path) await patch({ cartridgeImage: data.path });
    else alert(data.error ?? "Selection failed");
  }

  async function confirmManualCrop(box: Box) {
    if (!origImg) return;
    setProcessingLabel(true);
    const fd = new FormData();
    fd.append("crop", JSON.stringify(box));
    fd.append("original", origImg);
    fd.append("gameId", game?.romCrc ?? id);
    const res = await fetch("/api/process-cartridge", { method: "POST", body: fd });
    const data = await res.json();
    setProcessingLabel(false);
    closeChooser();
    if (data.path) await patch({ cartridgeImage: data.path });
    else alert(data.error ?? "Crop failed");
  }

  async function deleteGame() {
    if (!confirm(`Really delete "${game?.title}"?`)) return;
    await fetch(`/api/games/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-zinc-800 rounded w-1/3" />
        <div className="h-64 bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="text-center py-20 text-zinc-600">
        <p className="text-4xl mb-3">❓</p>
        <p>Game not found.</p>
        <a href="/" className="text-xs text-zinc-400 underline mt-2 inline-block">Back to overview</a>
      </div>
    );
  }

  const platformColor = PLATFORM_COLORS[game.platform];
  const statusColor = STATUS_COLORS[game.status];
  const hasCartridgeLabel = !!game.cartridgeImage;
  const hasLibraryImg = !!game.libraryImage;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <a href={backHref} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Back
        </a>
        {!editing && authenticated && (
          <button
            onClick={startEdit}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-300 rounded-lg transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        /* ── EDIT MODE ── */
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-100">Edit Game</h2>

          <Field label="Title *">
            <input type="text" value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} />
          </Field>



          <div className="grid grid-cols-2 gap-3">
            <Field label="Year">
              <input type="number" value={form.year ?? 0} min={1989} max={2010}
                onChange={(e) => set("year", parseInt(e.target.value))} className={inputCls} />
            </Field>
            <Field label="System" >
              <select value={form.platform ?? "GB"} onChange={(e) => set("platform", e.target.value)}
                className={selectCls}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Spent (€)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">€</span>
              <input
                type="text"
                inputMode="decimal"
                value={(form.purchasePrice as string) ?? ""}
                onChange={(e) => set("purchasePrice", e.target.value)}
                onBlur={(e) => {
                  const normalized = normalizePrice(e.target.value);
                  set("purchasePrice", normalized);
                }}
                placeholder="12.50"
                className={`${inputCls} pl-7`}
              />
            </div>
          </Field>

          <Field label="Added (DD.MM.YYYY)">
            <input
              type="text"
              value={(form.createdAt as string) ?? ""}
              onChange={(e) => set("createdAt", e.target.value)}
              placeholder="DD.MM.YYYY"
              className={inputCls}
            />
          </Field>

          <Field label="Notes">
            <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)}
              rows={6} className={`${inputCls} resize-y h-auto py-2`} />
          </Field>

          <div className="flex gap-2 pt-2">
            <button onClick={saveEdit} disabled={saving || !form.title}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-sm text-zinc-100 rounded-lg transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              Cancel
            </button>
          </div>

          <div className="border-t border-zinc-800 pt-4 mt-2">
            <button onClick={deleteGame} className="text-xs text-red-600 hover:text-red-400 transition-colors">
              Delete game
            </button>
          </div>
        </div>
      ) : (
        /* ── VIEW MODE ── */
        <>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 mb-8">
            {/* Image area */}
            <div className="w-full max-w-[92vw] sm:w-48 sm:max-w-[192px] sm:shrink-0 mx-auto sm:mx-0">
              {/* Toggle: show when library image exists (with or without cartridge) */}
              {hasLibraryImg && (
                <div className="flex mb-2 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setImageView("cartridge")}
                    className={`flex-1 py-2 sm:py-1 text-xs rounded-md transition-colors ${
                      imageView === "cartridge"
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Cartridge
                  </button>
                  <button
                    onClick={() => setImageView("cover")}
                    className={`flex-1 py-2 sm:py-1 text-xs rounded-md transition-colors ${
                      imageView === "cover"
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Cover
                  </button>
                </div>
              )}

              {/* Image display */}
              {(!hasLibraryImg || imageView === "cartridge") ? (
                /* Cartridge view */
                hasCartridgeLabel ? (
                  <div
                    className="flex items-center justify-center bg-zinc-800 border border-zinc-700 rounded-xl aspect-square cursor-zoom-in"
                    onClick={() => setCartridgeLightbox(true)}
                  >
                    <CartridgeSVG platform={game.platform} labelSrc={game.cartridgeImage} className="w-full h-full" thumb />
                  </div>
                ) : (
                  /* No cartridge image — placeholder with + button when authenticated */
                  <label className={`bg-zinc-800 border border-zinc-700 rounded-xl aspect-square flex flex-col items-center justify-center gap-2 text-zinc-600 ${authenticated ? "cursor-pointer hover:border-zinc-500 hover:bg-zinc-700/40 transition-colors group" : ""}`}>
                    {processingLabel ? (
                      <span className="text-xs text-zinc-500 animate-pulse">Extracting label…</span>
                    ) : authenticated ? (
                      <>
                        <span className="text-3xl text-zinc-500 group-hover:text-zinc-300 transition-colors">+</span>
                        <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">Add cartridge photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadCartridgePhoto(file);
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <span className="text-5xl">🎮</span>
                        <span className="text-xs font-mono">{game.platform}</span>
                      </>
                    )}
                  </label>
                )
              ) : (
                /* Cover view */
                <div
                  className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden relative flex items-center justify-center aspect-[160/144] cursor-zoom-in"
                  onClick={() => setImageLightbox(game.libraryImage!)}
                >
                  <Image
                    src={game.libraryImage!}
                    alt={game.title}
                    fill
                    className="object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
              )}

              {/* Subtle cartridge image actions (replace / remove) */}
              {authenticated && hasCartridgeLabel && (!hasLibraryImg || imageView === "cartridge") && (
                <div className="mt-1.5 flex items-center justify-center gap-3">
                  {processingLabel ? (
                    <span className="text-xs text-zinc-600 animate-pulse">Extracting label…</span>
                  ) : (
                    <>
                      <label className="cursor-pointer inline-flex items-center">
                        <span className="text-[11px] text-zinc-700 hover:text-zinc-500 transition-colors">Replace</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadCartridgePhoto(file);
                          }}
                        />
                      </label>
                      <span className="text-zinc-800 text-[11px]">·</span>
                      <button
                        onClick={deleteCartridgeImage}
                        className="text-[11px] text-zinc-700 hover:text-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Variant chooser — pick the best crop after uploading a photo */}
            {variants && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closeChooser}>
                <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  {manualMode && origImg && detectedBox ? (
                    <>
                      <h2 className="text-sm font-semibold text-zinc-100 mb-1">Adjust the crop</h2>
                      <p className="text-xs text-zinc-500 mb-4">Drag the box and corners to frame the cover.</p>
                      <CropEditor
                        src={origImg}
                        initial={detectedBox}
                        busy={processingLabel}
                        onCancel={() => setManualMode(false)}
                        onConfirm={confirmManualCrop}
                      />
                    </>
                  ) : (
                    <>
                      <h2 className="text-sm font-semibold text-zinc-100 mb-1">Choose the best crop</h2>
                      <p className="text-xs text-zinc-500 mb-4">Tap the version that frames the cover best.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {variants.map((v) => (
                          <button
                            key={v.key}
                            onClick={() => chooseVariant(v.path)}
                            disabled={processingLabel}
                            className="group rounded-xl border border-zinc-700 hover:border-zinc-400 bg-zinc-800 p-2 transition-colors disabled:opacity-50"
                          >
                            <div className="aspect-square">
                              <CartridgeSVG platform={game.platform} labelSrc={v.path} className="w-full h-full" thumb />
                            </div>
                            <span className="block mt-1.5 text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">{v.label}</span>
                          </button>
                        ))}
                      </div>
                      {origImg && detectedBox && (
                        <button
                          onClick={() => setManualMode(true)}
                          disabled={processingLabel}
                          className="mt-3 w-full py-2 rounded-lg text-sm font-medium text-zinc-300 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                        >
                          ✂️ Manual crop
                        </button>
                      )}
                      <button
                        onClick={closeChooser}
                        className="mt-2 w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Info */}
            <div className="flex-1 space-y-3">
              <div className="flex items-start gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${platformColor}`}>
                  {game.platform}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs border ${statusColor}`}>
                  {STATUS_LABELS[game.status]}
                </span>
              </div>

              <h1 className="text-2xl font-bold text-zinc-100 leading-tight">{game.title}</h1>

              <div className="text-sm text-zinc-400 space-y-0.5">

                {game.year > 0 && <p><span className="text-zinc-600">Year</span>{" "}{game.year}</p>}
                {game.purchasePrice && <p><span className="text-zinc-600">Spent</span>{" "}{formatEuro(game.purchasePrice)}</p>}
                {game.romCrc && <p><span className="text-zinc-600">ROM ID</span>{" "}<span className="font-mono text-xs text-zinc-500">{game.romCrc}</span></p>}
              </div>

              <div>
                <p className="text-xs text-zinc-600 mb-1">Rating</p>
                <StarRatingInput value={game.rating} onChange={(v) => patch({ rating: v })} />
              </div>


              <div>
                <p className="text-xs text-zinc-600 mb-1">Status</p>

                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => {
                    const isActive = game.status === s;
                    // "Owned" (backlog) gets a subtle highlight when game is playing/completed
                    const isImplied = s === "backlog" && !isActive && OWNED_STATUSES.includes(game.status);
                    return (
                      <button key={s} onClick={() => patch({ status: s })}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                          isActive
                            ? STATUS_COLORS[s]
                            : isImplied
                            ? "border-emerald-700 text-emerald-600 bg-emerald-900/20"
                            : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                        }`}>
                        {STATUS_LABELS[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
            <StatBox label="Added" value={game.createdAt ? (() => { const d = new Date(game.createdAt!); const dd = String(d.getDate()).padStart(2,"0"); const mm = String(d.getMonth()+1).padStart(2,"0"); const yy = String(d.getFullYear()).slice(-2); return `${dd}.${mm}.${yy}`; })() : "—"} />
            <StatBox label="Play time" value={formatPlaytime(game.playtime)} />
            <StatBox
              label="Lent out"
              value={game.lent ? "✓" : "—"}
              onClick={authenticated && OWNED_STATUSES.includes(game.status) ? () => patch({ lent: !game.lent }) : undefined}
              active={game.lent}
            />
          </div>

          {/* Notes */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-300 mb-2">Notes</h2>
            <div className="text-sm text-zinc-400 whitespace-pre-wrap bg-zinc-900 border border-zinc-800 rounded-xl p-4 min-h-16">
              {game.notes ? renderNotes(game.notes) : <span className="text-zinc-700">No notes</span>}
            </div>
          </div>

          {/* Pocket Screenshots */}
          {(() => {
            const gameScreenshots = screenshots.filter(s => s.gameId === id);
            if (gameScreenshots.length === 0) return null;
            return (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-zinc-300">Pocket Screenshots</h2>
                  <span className="text-[10px] text-zinc-600">{gameScreenshots.length} image{gameScreenshots.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {gameScreenshots.map(s => (
                    <div
                      key={s.filename}
                      onClick={() => setLightboxImg(s.filename)}
                      className="aspect-square rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-zinc-600 cursor-pointer transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/screenshots/${encodeURIComponent(s.filename)}`}
                        alt={s.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Playtime Progress — auto-loaded from HLTB */}
          <div className="mb-8">
              <h2 className="text-sm font-semibold text-zinc-300 mb-2">Playtime Progress</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 space-y-2">
                {!hltbLoading && (!hltb || hltb.hltbMain == null) && !hltbCandidates ? (
                  <div className="flex items-center justify-between text-[10px] text-zinc-600">
                    <span>No HowLongToBeat data found</span>
                    {hltbLinkEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={hltbLinkInput}
                          onChange={e => setHltbLinkInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveHltbLink(); if (e.key === "Escape") { setHltbLinkEditing(false); setHltbLinkInput(""); } }}
                          placeholder="https://howlongtobeat.com/game/1250"
                          className="text-[10px] bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-zinc-300 w-56 outline-none focus:border-zinc-500"
                        />
                        <button onClick={saveHltbLink} className="text-zinc-400 hover:text-zinc-200">✓</button>
                        <button onClick={() => { setHltbLinkEditing(false); setHltbLinkInput(""); }} className="text-zinc-600 hover:text-zinc-400">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setHltbLinkEditing(true)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                        Link HowLongToBeat ✎
                      </button>
                    )}
                  </div>
                ) : hltbLoading ? (
                  <>
                    <div className="flex justify-between">
                      <div className="h-3 w-24 bg-zinc-800 rounded animate-pulse" />
                      <div className="h-3 w-20 bg-zinc-800 rounded animate-pulse" />
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full animate-pulse" />
                    <div className="h-2.5 w-32 bg-zinc-800 rounded animate-pulse" />
                  </>
                ) : hltbCandidates ? (
                  <div>
                    <p className="text-xs text-zinc-400 mb-2">Multiple matches found on HowLongToBeat — please select the correct one:</p>
                    <div className="space-y-1">
                      {hltbCandidates.map(c => (
                        <button
                          key={c.hltbId}
                          onClick={() => confirmHltbCandidate(c.hltbId)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-left transition-colors"
                        >
                          <span className="text-xs text-zinc-200">{c.title}</span>
                          <span className="text-[10px] text-zinc-500 shrink-0 ml-2">
                            {c.hltbMain != null ? `~${c.hltbMain}h` : "—"}
                            {c.hltbComplete != null ? ` · ${c.hltbComplete}h 100%` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setHltbCandidates(null)}
                      className="mt-2 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      Skip
                    </button>
                  </div>
                ) : (() => {
                  const actualMins = game.playtime ?? 0;
                  const hasPlaytime = actualMins > 0;
                  const avgMins = hltb!.hltbMain! * 60;
                  const completed = game.status === "completed";
                  const playing = game.status === "playing";
                  const pct = Math.min(actualMins / avgMins, 1);
                  const playedH = (actualMins / 60).toFixed(1);
                  const diffMins = Math.abs(avgMins - actualMins);
                  const diffH = (diffMins / 60).toFixed(1);
                  const faster = actualMins < avgMins;
                  const barColor = completed ? "bg-blue-500" : playing ? "bg-green-500" : "bg-zinc-500";
                  const labelColor = completed ? "text-blue-400" : playing ? "text-green-400" : "text-zinc-300";
                  return (
                    <>
                      {hasPlaytime && (
                        <>
                          <div className="flex justify-between items-baseline text-xs">
                            <span className={`${labelColor} font-medium`}>
                              {completed ? "🎉 Completed" : `${playedH}h played`}
                            </span>
                            <span className="text-zinc-500">
                              {completed
                                ? faster ? `${diffH}h faster than avg` : `${diffH}h longer than avg`
                                : `~${diffH}h left`}
                            </span>
                          </div>
                          <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                              style={{ width: `${Math.round(pct * 100)}%` }}
                            />
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-baseline text-[10px] text-zinc-600">
                        <span>⏱ Avg ~{hltb!.hltbMain}h main{hltb!.hltbComplete != null ? ` · ~${hltb!.hltbComplete}h 100%` : ""}</span>
                        <div className="flex items-center gap-1.5">
                          {hltbLinkEditing ? (
                            <>
                              <input
                                autoFocus
                                value={hltbLinkInput}
                                onChange={e => setHltbLinkInput(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") saveHltbLink(); if (e.key === "Escape") { setHltbLinkEditing(false); setHltbLinkInput(""); } }}
                                placeholder="https://howlongtobeat.com/game/1250"
                                className="text-[10px] bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-zinc-300 w-56 outline-none focus:border-zinc-500"
                              />
                              <button onClick={saveHltbLink} className="text-zinc-400 hover:text-zinc-200">✓</button>
                              <button onClick={() => { setHltbLinkEditing(false); setHltbLinkInput(""); }} className="text-zinc-600 hover:text-zinc-400">✕</button>
                            </>
                          ) : (
                            <>
                              <a
                                href={hltb!.hltbId ? `https://howlongtobeat.com/game/${hltb!.hltbId}` : `https://howlongtobeat.com/?q=${encodeURIComponent(game.title)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-zinc-600 hover:text-zinc-400 transition-colors"
                              >
                                HowLongToBeat ↗
                              </a>
                              {!hltb!.hltbId && (
                                <button
                                  onClick={() => setHltbLinkEditing(true)}
                                  className="text-zinc-700 hover:text-zinc-400 transition-colors"
                                  title="Set HLTB game link"
                                >
                                  ✎
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

          {/* AI Info */}
          <AiSection
            gameId={game.id}
            title={game.title}
            platform={game.platform}
            gameYear={game.year}
            onYearAdopted={(y) => setGame((g) => g ? { ...g, year: y } : g)}
            authenticated={authenticated}
          />

        </>
      )}

      {/* Screenshot lightbox */}
      {lightboxImg && (() => {
        const gameScreenshots = screenshots.filter(s => s.gameId === id);
        const idx = gameScreenshots.findIndex(s => s.filename === lightboxImg);
        const dt = formatScreenshotDateTime(lightboxImg);
        const s = gameScreenshots[idx];
        return (
          <LightboxOverlay
            srcs={gameScreenshots.map(gs => `/api/screenshots/${encodeURIComponent(gs.filename)}`)}
            index={idx}
            onClose={() => setLightboxImg(null)}
            onIndexChange={i => setLightboxImg(gameScreenshots[i].filename)}
            pixelated
            imgStyle={{ minWidth: "min(640px, 80vw)", minHeight: "min(480px, 50vh)" }}
            header={
              dt ? (
                <>
                  <p className="text-sm font-semibold text-zinc-100">{dt.date} · {dt.time}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5 truncate">{lightboxImg}</p>
                </>
              ) : (
                <p className="text-xs text-zinc-400 truncate">{lightboxImg}</p>
              )
            }
            actions={
              <>
                {s && (
                  <a
                    href={`/api/screenshots/${encodeURIComponent(s.filename)}`}
                    download={s.filename}
                    className="px-3 py-4 sm:p-2 text-zinc-600 hover:text-zinc-100 transition-colors"
                    title="Download"
                    onClick={e => e.stopPropagation()}
                  >
                    <DownloadIcon />
                  </a>
                )}
                {s && authenticated && (
                  <>
                    <button
                      onClick={() => toggleHighlight(s.filename, !s.highlight)}
                      className={`px-3 py-4 sm:p-2 transition-colors ${s.highlight ? "text-amber-400 hover:text-amber-300" : "text-zinc-600 hover:text-amber-400"}`}
                      title={s.highlight ? "Remove from favorites" : "Mark as favorite"}
                    >
                      <StarIcon filled={s.highlight} />
                    </button>
                    <button
                      onClick={() => deleteScreenshot(s.filename)}
                      className="px-3 py-4 sm:p-2 text-zinc-600 hover:text-red-400 transition-colors"
                      title="Delete screenshot"
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </>
            }
            bottomBar={
              <div className="py-3 text-center">
                <p className="text-xs text-zinc-600">{idx + 1} / {gameScreenshots.length}</p>
              </div>
            }
          />
        );
      })()}

      {/* Cartridge lightbox — full shell rendering */}
      {cartridgeLightbox && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setCartridgeLightbox(false)}>
          <button onClick={() => setCartridgeLightbox(false)} className="absolute top-3 right-3 px-3 py-4 sm:p-2 text-zinc-400 hover:text-zinc-100 text-xl leading-none">✕</button>
          <div className="w-[min(80vw,80vh)] h-[min(80vw,80vh)]" onClick={e => e.stopPropagation()}>
            <CartridgeSVG platform={game.platform} labelSrc={game.cartridgeImage} className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Cover image lightbox */}
      {imageLightbox && (
        <LightboxOverlay
          srcs={[imageLightbox]}
          index={0}
          onClose={() => setImageLightbox(null)}
          onIndexChange={() => {}}
          pixelated
        />
      )}
    </div>
  );
}

interface AiInfo {
  description: string;
  developer: string;
  publisher: string;
  genre: string;
  releaseYear: number | null;
  metacriticScore: number | null;
  userScore: number | null;
  hltbPlaytimeMain: number | null;
  hltbPlaytimeComplete: number | null;
  youtubeQuery: string;
  mobySlug: string;
  screenshots: string[];
  reviewScores?: { outlet: string; score: string; url?: string }[];
  cachedAt?: string;
}

function ScoreBadge({ label, score, max }: { label: string; score: number | null; max: number }) {
  if (score === null) return null;
  const pct = score / max;
  const color = pct >= 0.75 ? "text-green-400 border-green-500/30" : pct >= 0.5 ? "text-amber-400 border-amber-500/30" : "text-red-400 border-red-500/30";
  return (
    <div className={`flex flex-col items-center border rounded-xl px-4 py-2.5 ${color}`}>
      <span className="text-xl font-bold tabular-nums">{score}</span>
      <span className="text-[10px] text-zinc-500 mt-0.5">{label}</span>
    </div>
  );
}

function ScreenshotGallery({ urls }: { urls: string[] }) {
  const [visible, setVisible] = useState<boolean[]>(() => urls.map(() => true));
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const shown = urls.map((url, i) => ({ url, i })).filter((_, i) => visible[i]);
  const shownUrls = shown.map((s) => s.url);

  if (shown.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Screenshots</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {shown.map(({ url, i }, shownI) => (
          <button
            key={i}
            onClick={() => setLightboxIdx(shownI)}
            className="aspect-video bg-zinc-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-zinc-500 transition-all flex items-center justify-center p-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Screenshot ${shownI + 1}`}
              className="max-w-full max-h-full object-contain"
              style={{ imageRendering: "pixelated" }}
              onError={() => setVisible((v) => { const n = [...v]; n[i] = false; return n; })}
            />
          </button>
        ))}
      </div>

      {lightboxIdx !== null && (
        <LightboxOverlay
          srcs={shownUrls}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onIndexChange={setLightboxIdx}
          header={
            <p className="text-xs text-zinc-600">{lightboxIdx + 1} / {shownUrls.length}</p>
          }
          actions={
            <a
              href={shownUrls[lightboxIdx]}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-4 sm:p-2 text-zinc-600 hover:text-zinc-100 transition-colors flex items-center"
            >
              <DownloadIcon />
            </a>
          }
          bottomBar={
            shownUrls.length > 1 ? (
              <div className="py-3 flex justify-center gap-1.5">
                {shownUrls.map((_, i) => (
                  <button key={i} onClick={() => setLightboxIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === lightboxIdx ? "bg-white" : "bg-white/30"}`} />
                ))}
              </div>
            ) : undefined
          }
        />
      )}
    </div>
  );
}


function AiSection({ gameId, title, platform, gameYear, onYearAdopted, authenticated }: { gameId: string; title: string; platform: string; gameYear: number; onYearAdopted: (y: number) => void; authenticated: boolean }) {
  const [info, setInfo] = useState<AiInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [yearSaved, setYearSaved] = useState(false);
  // On mount: check cache silently
  useEffect(() => {
    fetch(`/api/games/${gameId}/ai-info?cached_only=1`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) { setInfo(data); setLoaded(true); } })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/games/${gameId}/ai-info?title=${encodeURIComponent(title)}&platform=${encodeURIComponent(platform)}`);
      if (!res.ok) throw new Error();
      setInfo(await res.json());
      setLoaded(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function resetCache() {
    await fetch(`/api/games/${gameId}/ai-info`, { method: "DELETE" });
    setInfo(null);
    setLoaded(false);
    setYearSaved(false);
  }

  function formatCacheDate(iso: string) {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()} ${hh}:${min}`;
  }

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-zinc-300">External Info</h2>
        <div className="flex items-center gap-2">
          {loaded && info?.cachedAt && (
            <span className="text-[10px] text-zinc-600">Cached {formatCacheDate(info.cachedAt)}</span>
          )}
          {loaded && authenticated && (
            <button
              onClick={resetCache}
              className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
              title="Reset AI cache"
            >
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {!loaded && !loading && (
        <button
          onClick={load}
          className="w-full py-3 bg-zinc-900 border border-zinc-800 border-dashed rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
        >
          ✨ Load AI info
        </button>
      )}

      {loading && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin shrink-0" />
          <span className="text-sm text-zinc-500">Fetching game info…</span>
        </div>
      )}

      {error && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-red-400">
          Could not load AI info. <button onClick={load} className="underline hover:text-red-300">Try again</button>
        </div>
      )}

      {loaded && info && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
          {/* Meta row with year adopt button */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            {info.developer && <span><span className="text-zinc-600">Dev</span> {info.developer}</span>}
            {info.publisher && <span><span className="text-zinc-600">Pub</span> {info.publisher}</span>}
            {info.genre && <span><span className="text-zinc-600">Genre</span> {info.genre}</span>}
            {(info.hltbPlaytimeMain != null || info.hltbPlaytimeComplete != null) && (
              <span>
                <span className="text-zinc-600">⏱ Avg</span>{" "}
                {info.hltbPlaytimeMain != null && `${info.hltbPlaytimeMain}h`}
                {info.hltbPlaytimeMain != null && info.hltbPlaytimeComplete != null && " · "}
                {info.hltbPlaytimeComplete != null && <span className="text-zinc-600">{info.hltbPlaytimeComplete}h 100%</span>}
              </span>
            )}
            {info.releaseYear && (
              <span className="flex items-center gap-1.5">
                <span className="text-zinc-600">Year</span> {info.releaseYear}
                {info.releaseYear !== gameYear && !yearSaved && (
                  <button
                    onClick={async () => {
                      await fetch(`/api/games/${gameId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ year: info.releaseYear }),
                      });
                      onYearAdopted(info.releaseYear!);
                      setYearSaved(true);
                    }}
                    className="ml-1 px-2 py-0.5 rounded text-[10px] border border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    {gameYear > 0 ? `Replace ${gameYear}` : "Use this year"}
                  </button>
                )}
                {yearSaved && <span className="text-green-500 text-[10px]">✓ Saved</span>}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-zinc-300 leading-relaxed">{info.description}</p>

          {/* Press review scores */}
          {info.reviewScores && info.reviewScores.length > 0 ? (
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Press scores <span className="normal-case text-zinc-700">· via Wikipedia</span></p>
              <div className="flex flex-wrap gap-2">
                {info.reviewScores.map((r) => {
                  const inner = (
                    <div className="flex flex-col items-center px-3 py-2 bg-zinc-800 rounded-lg min-w-[64px] text-center">
                      <span className="text-base font-bold text-zinc-100 leading-tight">{r.score}</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{r.outlet}</span>
                    </div>
                  );
                  return r.url ? (
                    <a key={r.outlet} href={r.url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">{inner}</a>
                  ) : (
                    <div key={r.outlet}>{inner}</div>
                  );
                })}
              </div>
            </div>
          ) : (info.metacriticScore !== null || info.userScore !== null) ? (
            <div className="flex gap-3">
              <ScoreBadge label="Metacritic" score={info.metacriticScore} max={100} />
              <ScoreBadge label="User score" score={info.userScore !== null ? Math.round(info.userScore * 10) : null} max={100} />
            </div>
          ) : null}

          {/* Screenshot slideshow */}
          {info.screenshots && info.screenshots.length > 0 && (
            <ScreenshotGallery urls={info.screenshots} />
          )}

          {/* YouTube */}
          {info.youtubeQuery && (
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(info.youtubeQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-4 py-2.5 bg-red-950/30 border border-red-900/40 rounded-lg text-sm text-red-300 hover:bg-red-950/50 hover:border-red-800/60 transition-colors w-fit"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              Watch gameplay on YouTube
            </a>
          )}
        </div>
      )}

    </div>
  );
}
