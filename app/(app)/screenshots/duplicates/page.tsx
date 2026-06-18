"use client";

import { useState } from "react";
import { formatScreenshotDate } from "@/lib/screenshot-date";

interface DuplicateGroup {
  files: string[];
  method: "exact" | "perceptual";
}

export default function ScreenshotDuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());

  async function runCheck() {
    setLoading(true);
    setGroups(null);
    setError(null);
    setDeleted(new Set());
    setProgress(0);
    setCurrentFile("");

    try {
      const res = await fetch("/api/screenshots/duplicates");
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Check failed.");
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6)) as {
              progress?: number;
              total?: number;
              current?: string;
              done?: boolean;
              groups?: DuplicateGroup[];
              error?: string;
            };
            if (msg.error) { setError(msg.error); break; }
            if (msg.progress !== undefined) {
              setProgress(msg.progress);
              setTotal(msg.total ?? 0);
              setCurrentFile(msg.current ?? "");
            }
            if (msg.done) {
              setGroups(msg.groups ?? []);
              setTotal(msg.total ?? 0);
            }
          } catch { /* malformed line */ }
        }
      }
    } catch (e) {
      setError(String(e));
    }

    setLoading(false);
    setCurrentFile("");
  }

  async function softDelete(filename: string) {
    await fetch(`/api/screenshots/${encodeURIComponent(filename)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted: true }),
    });
    setDeleted(prev => new Set([...prev, filename]));
  }

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <a href="/screenshots" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6 inline-block">
        ← Screenshots
      </a>

      <h2 className="text-xl font-bold text-zinc-100 mb-1">Duplicate screenshots</h2>
      <p className="text-xs text-zinc-500 mb-1">
        Find duplicate or near-duplicate images using perceptual hashing.
      </p>
      <p className="text-xs text-zinc-600 mb-6">
        Results are not 100% accurate — the check finds visually similar images, not just exact copies. Use it as a starting point to clean up your library.
      </p>

      <button
        onClick={runCheck}
        disabled={loading}
        className="w-full py-3 px-4 bg-zinc-800 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-700 disabled:opacity-40 rounded-xl text-sm font-medium text-zinc-200 transition-colors mb-8"
      >
        {loading ? "Checking…" : "Run duplicate check"}
      </button>

      {/* Progress */}
      {loading && (
        <div className="mb-8 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="truncate max-w-xs text-zinc-600">{currentFile}</span>
            <span className="shrink-0 tabular-nums">{progress} / {total}</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-400 rounded-full transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-700 text-right">{pct}%</p>
        </div>
      )}

      {error && (
        <div className="bg-red-950/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-400 mb-4">
          {error}
        </div>
      )}

      {groups !== null && !loading && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-zinc-500">
              Checked <span className="text-zinc-300">{total}</span> screenshot{total !== 1 ? "s" : ""}
              {" · "}
              <span className={groups.length > 0 ? "text-amber-400" : "text-green-500"}>
                {groups.length === 0 ? "no duplicates found" : `${groups.length} group${groups.length !== 1 ? "s" : ""} found`}
              </span>
            </p>
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <p className="text-3xl mb-3">✓</p>
              <p className="text-sm">No duplicates detected.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group, gi) => {
                if (group.files.every(f => deleted.has(f))) return null;
                return (
                  <div key={gi} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                      <span className={`text-xs font-medium ${group.method === "exact" ? "text-red-400" : "text-amber-400"}`}>
                        {group.method === "exact" ? "Exact duplicate" : "Near-duplicate"}
                      </span>
                      <span className="text-xs text-zinc-600">{group.files.length} images</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3">
                      {group.files.map(filename => {
                        const isDeleted = deleted.has(filename);
                        return (
                          <div
                            key={filename}
                            className={`rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 transition-opacity ${isDeleted ? "opacity-25" : ""}`}
                          >
                            <div className="w-full aspect-[160/144]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/screenshots/${encodeURIComponent(filename)}`}
                                alt={filename}
                                className="w-full h-full object-contain"
                                style={{ imageRendering: "pixelated" }}
                                loading="lazy"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-t border-zinc-700">
                              <div className="min-w-0">
                                <p className="text-[10px] text-zinc-500 font-mono truncate">{filename}</p>
                                <p className="text-[10px] text-zinc-700">{formatScreenshotDate(filename) ?? ""}</p>
                              </div>
                              {!isDeleted ? (
                                <button
                                  onClick={() => softDelete(filename)}
                                  className="shrink-0 text-xs text-zinc-600 hover:text-red-400 border border-zinc-700 hover:border-red-800 rounded-lg px-2.5 py-1 transition-colors"
                                >
                                  Delete
                                </button>
                              ) : (
                                <span className="shrink-0 text-xs text-zinc-700">Deleted</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
