"use client";

import { useState, useRef } from "react";

interface PreviewRow {
  row: number;
  title: string;
  action: "added" | "updated" | "skipped";
  reason?: string;
}

interface PreviewResult {
  preview: PreviewRow[];
  addCount: number;
  updateCount: number;
}

const ACTION_STYLE: Record<string, string> = {
  added:   "text-green-400",
  updated: "text-amber-400",
  skipped: "text-zinc-600",
};

const ACTION_LABEL: Record<string, string> = {
  added:   "New",
  updated: "Update",
  skipped: "Skip",
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ added: number; updated: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setDone(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import-excel", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Unknown error"); return; }
    setPreview(data);
  }

  async function handleConfirm() {
    if (!file || !preview) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("confirm", "1");
    const res = await fetch("/api/import-excel", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Unknown error"); return; }
    setDone({ added: data.added, updated: data.updated });
    setPreview(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="max-w-2xl mx-auto">
      <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6 inline-block">← Back</a>
      <h2 className="text-xl font-bold text-zinc-100 mb-1">Excel Import</h2>
      <p className="text-xs text-zinc-500 mb-6">Import your game collection from an Excel file (.xlsx). Existing games (matched by title) will be updated.</p>

      {/* Column reference */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
        <p className="text-xs font-medium text-zinc-400 mb-2">Expected columns (first row = headers)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">
          {[
            ["Title *", "required"],
            ["Platform", "GB / GBC / GBA"],
            ["Status", "playing / completed / owned / wishlist"],
            ["Year", "e.g. 1993"],
            ["Developer", ""],
            ["Publisher", ""],
            ["Genre", "comma-separated"],
            ["Rating", "1–5"],
            ["Spent", "e.g. 12.50"],
            ["Added", "DD.MM.YYYY"],
            ["Notes", ""],
          ].map(([col, hint]) => (
            <div key={col} className="flex items-baseline gap-1.5">
              <span className="text-xs font-mono text-zinc-300">{col}</span>
              {hint && <span className="text-[10px] text-zinc-600">{hint}</span>}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600 mt-3">Column names are case-insensitive and German names work too (Titel, System, Bewertung, …)</p>
      </div>

      {/* File picker */}
      <div
        className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-500 transition-colors mb-4"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.ods,.csv"
          className="hidden"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setDone(null); setError(null); }}
        />
        {file ? (
          <div>
            <p className="text-sm text-zinc-100 font-medium">{file.name}</p>
            <p className="text-xs text-zinc-500 mt-1">{(file.size / 1024).toFixed(1)} KB · click to change</p>
          </div>
        ) : (
          <div>
            <p className="text-3xl mb-2">📂</p>
            <p className="text-sm text-zinc-400">Click to select Excel file</p>
            <p className="text-xs text-zinc-600 mt-1">.xlsx · .xls · .ods · .csv</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {done && (
        <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4 mb-4">
          <p className="text-sm text-green-400 font-medium">Import complete</p>
          <p className="text-xs text-zinc-400 mt-1">{done.added} games added · {done.updated} games updated</p>
          <a href="/" className="mt-3 inline-block text-xs text-zinc-300 hover:text-white underline">Go to collection →</a>
        </div>
      )}

      {!preview && !done && (
        <button
          onClick={handlePreview}
          disabled={!file || loading}
          className="w-full py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-sm font-medium text-zinc-100 rounded-lg transition-colors"
        >
          {loading ? "Reading file…" : "Preview import"}
        </button>
      )}

      {preview && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-300">
              <span className="text-green-400 font-medium">{preview.addCount} new</span>
              {" · "}
              <span className="text-amber-400 font-medium">{preview.updateCount} updates</span>
              {" · "}
              <span className="text-zinc-500">{preview.preview.filter(r => r.action === "skipped").length} skipped</span>
            </p>
            <button onClick={() => setPreview(null)} className="text-xs text-zinc-600 hover:text-zinc-400">✕ Cancel</button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4">
            <div className="max-h-72 overflow-y-auto">
              {preview.preview.map((row) => (
                <div key={row.row} className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800/60 last:border-0">
                  <span className="text-[10px] font-mono text-zinc-600 w-8 shrink-0">{row.row}</span>
                  <span className="text-sm text-zinc-200 flex-1 truncate">{row.title}</span>
                  <span className={`text-[10px] font-medium shrink-0 ${ACTION_STYLE[row.action]}`}>
                    {ACTION_LABEL[row.action]}
                    {row.reason ? ` · ${row.reason}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-sm font-medium text-zinc-100 rounded-lg transition-colors"
            >
              {loading ? "Importing…" : `Confirm import (${preview.addCount + preview.updateCount} games)`}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
