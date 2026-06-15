"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import CartridgeSVG from "@/app/components/CartridgeSVG";
import CropEditor, { type Box } from "@/app/components/CropEditor";
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
const PLATFORMS: Platform[] = ["GB", "GBC", "GBA", "GBP"];

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="text-xl font-bold text-zinc-100">{value}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
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

const inputCls = "w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors";

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingLabel, setProcessingLabel] = useState(false);
  const [imageView, setImageView] = useState<"cartridge" | "cover">("cartridge");
  const [variants, setVariants] = useState<{ key: string; label: string; path: string }[] | null>(null);
  const [origImg, setOrigImg] = useState<string | null>(null);
  const [detectedBox, setDetectedBox] = useState<Box | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [form, setForm] = useState<Partial<Game>>({});

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
    checkAuth();
  }, [id, checkAuth]);

  function startEdit() {
    if (!game) return;
    setForm({
      title: game.title,
      developer: game.developer,
      publisher: game.publisher,
      year: game.year,
      platform: game.platform,
      notes: game.notes,
      purchasePrice: game.purchasePrice ?? "",
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
    await patch({ ...form, purchasePrice: (form.purchasePrice as string) || null });
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
    fd.append("gameId", id);
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
    fd.append("gameId", id);
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
    fd.append("gameId", id);
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
    <div className="max-w-3xl">
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
            <Field label="Developer">
              <input type="text" value={form.developer ?? ""} onChange={(e) => set("developer", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Publisher">
              <input type="text" value={form.publisher ?? ""} onChange={(e) => set("publisher", e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Year">
              <input type="number" value={form.year ?? 0} min={1989} max={2010}
                onChange={(e) => set("year", parseInt(e.target.value))} className={inputCls} />
            </Field>
            <Field label="System" >
              <select value={form.platform ?? "GB"} onChange={(e) => set("platform", e.target.value)}
                className={inputCls}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Spent">
            <input type="text" value={(form.purchasePrice as string) ?? ""}
              onChange={(e) => set("purchasePrice", e.target.value)}
              placeholder="e.g. €12.50" className={inputCls} />
          </Field>

          <Field label="Notes">
            <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)}
              rows={3} className={`${inputCls} resize-none`} />
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
                    className={`flex-1 py-1 text-xs rounded-md transition-colors ${
                      imageView === "cartridge"
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Cartridge
                  </button>
                  <button
                    onClick={() => setImageView("cover")}
                    className={`flex-1 py-1 text-xs rounded-md transition-colors ${
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
                  <div className="flex items-center justify-center bg-zinc-800 border border-zinc-700 rounded-xl aspect-square">
                    <CartridgeSVG platform={game.platform} labelSrc={game.cartridgeImage} className="w-full h-full" />
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
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden relative flex items-center justify-center aspect-[160/144]">
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
                      <label className="cursor-pointer">
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
                              <CartridgeSVG platform={game.platform} labelSrc={v.path} className="w-full h-full" />
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
                {game.developer && <p><span className="text-zinc-600">Developer</span>{" "}{game.developer}</p>}
                {game.publisher && <p><span className="text-zinc-600">Publisher</span>{" "}{game.publisher}</p>}
                {game.year > 0 && <p><span className="text-zinc-600">Year</span>{" "}{game.year}</p>}
                {game.genre.length > 0 && <p><span className="text-zinc-600">Genre</span>{" "}{game.genre.join(", ")}</p>}
                {game.purchasePrice && <p><span className="text-zinc-600">Spent</span>{" "}{game.purchasePrice}</p>}
              </div>

              <div>
                <p className="text-xs text-zinc-600 mb-1">Rating</p>
                <StarRatingInput value={game.rating} onChange={(v) => patch({ rating: v })} />
              </div>

              {authenticated && OWNED_STATUSES.includes(game.status) && (
                <div>
                  <p className="text-xs text-zinc-600 mb-1">Lent out</p>
                  <button
                    onClick={() => patch({ lent: !game.lent })}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      game.lent
                        ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {game.lent ? "Yes — mark as returned" : "No — mark as lent out"}
                  </button>
                </div>
              )}

              <div>
                <p className="text-xs text-zinc-600 mb-1">Status</p>

                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => (
                    <button key={s} onClick={() => patch({ status: s })}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                        game.status === s ? STATUS_COLORS[s] : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                      }`}>
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
            <StatBox label="Play time" value={formatPlaytime(game.playtime)} />
            <StatBox label="Sessions" value={game.sessions} />
            <StatBox label="Last played"
              value={game.lastPlayed ? (() => { const d = new Date(game.lastPlayed!); const dd = String(d.getDate()).padStart(2,"0"); const mm = String(d.getMonth()+1).padStart(2,"0"); const yy = String(d.getFullYear()).slice(-2); return `${dd}.${mm}.${yy}`; })() : "—"} />
          </div>

          {/* Notes */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-300 mb-2">Notes</h2>
            <div className="text-sm text-zinc-400 whitespace-pre-wrap bg-zinc-900 border border-zinc-800 rounded-xl p-4 min-h-16">
              {game.notes ? renderNotes(game.notes) : <span className="text-zinc-700">No notes</span>}
            </div>
          </div>

          {/* Delete */}
          {authenticated && (
            <div className="border-t border-zinc-800 pt-6">
              <button onClick={deleteGame} className="text-xs text-red-600 hover:text-red-400 transition-colors">
                Delete game
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
