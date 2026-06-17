"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatScreenshotDateTime } from "@/lib/screenshot-date";

interface SyncChange {
  title: string;
  type: "added" | "playtime" | "status";
  before?: string;
  after?: string;
}

const REMINDER_OPTIONS: { label: string; days: number | null }[] = [
  { label: "Weekly", days: 7 },
  { label: "Every 2 weeks", days: 14 },
  { label: "Monthly", days: 30 },
  { label: "Every 3 months", days: 90 },
  { label: "Disabled", days: null },
];

function fmtFilename(filename: string): string {
  const dt = formatScreenshotDateTime(filename);
  if (!dt) return filename;
  return `${dt.date} · ${dt.time}`;
}

export default function PocketSyncPage() {
  const router = useRouter();
  const [lastSync, setLastSync] = useState<string | null | undefined>(undefined);
  const [overdue, setOverdue] = useState(false);
  const [binOverdue, setBinOverdue] = useState(false);
  const [screenshotOverdue, setScreenshotOverdue] = useState(false);
  const [reminderDays, setReminderDays] = useState<number | null>(30);
  const [screenshotBannerDismissed, setScreenshotBannerDismissed] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  // .bin files state
  const [listFile, setListFile] = useState<File | null>(null);
  const [playtimesFile, setPlaytimesFile] = useState<File | null>(null);
  const [binDragging, setBinDragging] = useState(false);
  const [binError, setBinError] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [changes, setChanges] = useState<SyncChange[]>([]);
  const binInputRef = useRef<HTMLInputElement>(null);

  // Screenshots state
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | { error: string } | null>(null);
  const [screenshotsDragging, setScreenshotsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/sync-status").then(r => r.json()).then(d => {
      setLastSync(d.syncedAt ?? null);
      setOverdue(d.overdue ?? false);
      setBinOverdue(d.binOverdue ?? false);
      setScreenshotOverdue(d.screenshotOverdue ?? false);
      setReminderDays(d.syncReminderDays ?? 30);
      setLatestScreenshot(d.latestScreenshot ?? null);
    });
    fetch("/api/auth").then(r => r.json()).then(d => setAuthenticated(d.authenticated));
    setScreenshotBannerDismissed(localStorage.getItem("screenshotBannerDismissed") === "1");
  }, []);

  function acceptBinFiles(files: FileList | File[]) {
    setBinError("");
    const arr = Array.from(files);
    const valid = arr.filter(f => f.name.endsWith(".bin"));
    const invalid = arr.filter(f => !f.name.endsWith(".bin"));
    if (invalid.length) setBinError(`Ignored ${invalid.length} non-.bin file${invalid.length > 1 ? "s" : ""}.`);
    for (const f of valid) {
      if (f.name === "list.bin") setListFile(f);
      else if (f.name === "playtimes.bin") setPlaytimesFile(f);
      else setBinError(prev => prev ? prev : `Unknown file: ${f.name} (expected list.bin or playtimes.bin)`);
    }
  }

  async function handleReminderChange(days: number | null) {
    setReminderDays(days);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncReminderDays: days }),
    });
    if (days === null) {
      setOverdue(false);
    } else {
      const isOverdue = lastSync === null || Date.now() - new Date(lastSync!).getTime() > days * 86_400_000;
      setOverdue(isOverdue);
    }
  }

  async function handleBinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listFile || !playtimesFile) return;
    setStatus("uploading");
    setOutput("");
    setError("");
    setChanges([]);
    const fd = new FormData();
    fd.append("list", listFile);
    fd.append("playtimes", playtimesFile);
    const res = await fetch("/api/pocket-sync", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      setStatus("done");
      setOutput(data.output ?? "");
      setChanges(data.changes ?? []);
      setLastSync(new Date().toISOString());
      setOverdue(false);
    } else {
      setStatus("error");
      setError(data.error ?? "Unknown error");
      setOutput(data.output ?? "");
    }
  }

  async function handleImportScreenshots() {
    setImporting(true);
    setImportResult(null);
    const res = await fetch("/api/screenshots/import", { method: "POST" });
    const data = await res.json();
    setImporting(false);
    if (res.ok) {
      setImportResult({ imported: data.imported, skipped: data.skipped });
      if (data.imported > 0) {
        // Refresh latest screenshot info
        fetch("/api/sync-status").then(r => r.json()).then(d => setLatestScreenshot(d.latestScreenshot ?? null));
      }
    } else {
      setImportResult({ error: data.error ?? "Import failed." });
    }
  }

  async function handleScreenshotUpload(files: FileList | null) {
    if (!files || !files.length) return;
    setUploadResult(null);
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    const res = await fetch("/api/screenshots", { method: "POST", body: fd });
    if (res.ok) {
      setUploadResult(`${files.length} file${files.length !== 1 ? "s" : ""} uploaded.`);
      fetch("/api/sync-status").then(r => r.json()).then(d => setLatestScreenshot(d.latestScreenshot ?? null));
    } else {
      setUploadResult("Upload failed.");
    }
  }

  const binReady = listFile && playtimesFile;

  return (
    <div className="max-w-xl mx-auto">
      <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6 inline-block">
        ← Back
      </a>

      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-xl font-bold text-zinc-100">Pocket Sync</h2>
        {lastSync && (
          <div className="text-right shrink-0">
            <p className="text-xs text-zinc-500">Last sync</p>
            <p className="text-sm font-medium text-zinc-300">
              {new Date(lastSync).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
            <p className="text-xs text-zinc-600">
              {new Date(lastSync).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        )}
        {lastSync === null && (
          <p className="text-xs text-zinc-600 shrink-0 pt-1">Never synced</p>
        )}
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Import play times, games, and screenshots from your Analogue Pocket.
      </p>

      {/* Overdue / info banners */}
      {overdue && (
        <div className="bg-amber-950/40 border border-amber-700 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-amber-400 text-lg leading-none">⏰</span>
          <p className="text-sm text-amber-300">
            {lastSync === null
              ? "You haven't synced yet. Upload your Pocket data to get started."
              : binOverdue && screenshotOverdue
                ? "Your play time data and screenshots are both due for an update."
                : binOverdue
                  ? "Your play time data is due for a sync. Upload the latest list.bin and playtimes.bin."
                  : "Your screenshots haven't been imported recently."}
          </p>
        </div>
      )}
      {!overdue && lastSync !== null && latestScreenshot === null && !screenshotBannerDismissed && (
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-zinc-400 text-lg leading-none">📷</span>
          <p className="text-sm text-zinc-400 flex-1">
            No screenshots imported yet. Import screenshots to build a visual archive of your gaming moments.
          </p>
          <button
            onClick={() => { setScreenshotBannerDismissed(true); localStorage.setItem("screenshotBannerDismissed", "1"); }}
            className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Section 1: Game data (.bin files) ── */}
      <div className="mb-8">
        <p className="text-sm font-semibold text-zinc-200 mb-1">Game data</p>
        <p className="text-xs text-zinc-500 mb-3">
          Drag both files at once, or click to browse.
        </p>

        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 mb-4 text-xs text-zinc-500">
          <span className="text-zinc-400 font-medium">SD card path: </span>
          <code className="font-mono text-zinc-400">System/Played Games/</code>
          <span className="ml-1 text-zinc-600">list.bin · playtimes.bin</span>
        </div>

        <form onSubmit={handleBinSubmit} className="space-y-3">
          {/* Combined drop zone */}
          <div
            onClick={() => binInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setBinDragging(true); }}
            onDragLeave={() => setBinDragging(false)}
            onDrop={e => { e.preventDefault(); setBinDragging(false); acceptBinFiles(e.dataTransfer.files); }}
            className={`border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${
              binDragging ? "border-blue-500 bg-blue-950/20"
              : (listFile && playtimesFile) ? "border-green-600 bg-green-950/20"
              : (listFile || playtimesFile) ? "border-amber-600/60 bg-amber-950/10"
              : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/40"
            }`}
          >
            <input
              ref={binInputRef}
              type="file"
              accept=".bin"
              multiple
              className="hidden"
              onChange={e => acceptBinFiles(e.target.files ?? [])}
            />
            {!listFile && !playtimesFile ? (
              <div className="text-center">
                <p className="text-zinc-400 text-sm">{binDragging ? "Drop .bin files here" : "Drop list.bin + playtimes.bin here"}</p>
                <p className="text-xs text-zinc-600 mt-1">Click to browse · Select both files at once</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 text-sm ${listFile ? "text-green-400" : "text-zinc-600"}`}>
                  <span>{listFile ? "✓" : "○"}</span>
                  <span>{listFile ? `${listFile.name} · ${(listFile.size / 1024).toFixed(1)} KB` : "list.bin missing"}</span>
                </div>
                <div className={`flex items-center gap-2 text-sm ${playtimesFile ? "text-green-400" : "text-zinc-600"}`}>
                  <span>{playtimesFile ? "✓" : "○"}</span>
                  <span>{playtimesFile ? `${playtimesFile.name} · ${(playtimesFile.size / 1024).toFixed(1)} KB` : "playtimes.bin missing"}</span>
                </div>
                {(!listFile || !playtimesFile) && (
                  <p className="text-xs text-zinc-600 pt-1">Drop or click to add the missing file.</p>
                )}
              </div>
            )}
          </div>

          {binError && <p className="text-xs text-amber-400">{binError}</p>}

          <button
            type="submit"
            disabled={!binReady || status === "uploading"}
            className="w-full py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-zinc-100 rounded-lg transition-colors"
          >
            {status === "uploading" ? "Importing…" : "Import game data"}
          </button>
        </form>
      </div>

      {/* ── Section 2: Screenshots ── */}
      <div className="mb-8 border-t border-zinc-800 pt-6">
        <p className="text-sm font-semibold text-zinc-200 mb-1">Screenshots</p>
        <p className="text-xs text-zinc-500 mb-3">
          Import screenshots from your Analogue Pocket.
        </p>

        {/* Latest screenshot info */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 mb-4 text-xs">
          {latestScreenshot ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-zinc-500">Latest imported: </span>
                <span className="text-zinc-300 font-medium">{fmtFilename(latestScreenshot)}</span>
              </div>
              <span className="text-zinc-600 font-mono shrink-0">{latestScreenshot}</span>
            </div>
          ) : (
            <p className="text-zinc-600">No screenshots imported yet.</p>
          )}
        </div>

        <div className="space-y-3">
          {/* Import from folder */}
          <div>
            <p className="text-xs text-zinc-500 mb-2">
              Copy screenshots to the mounted folder, then import:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 truncate">
                /analogue-pocket-screenshots/
              </code>
              <button
                onClick={handleImportScreenshots}
                disabled={importing}
                className="shrink-0 px-3 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {importing ? "Importing…" : "Import from folder"}
              </button>
            </div>
            {importResult && (
              <p className="text-xs mt-2 text-zinc-400">
                {"error" in importResult
                  ? <span className="text-red-400">{importResult.error}</span>
                  : importResult.imported === 0
                    ? "No new screenshots found."
                    : `${importResult.imported} screenshot${importResult.imported !== 1 ? "s" : ""} imported${importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ""}.`
                }
              </p>
            )}
          </div>

          {/* Web upload */}
          <div>
            <p className="text-xs text-zinc-500 mb-2">
              {latestScreenshot
                ? <>Or upload manually — only files <span className="text-zinc-300 font-medium">after {fmtFilename(latestScreenshot)}</span> are new.</>
                : "Or upload screenshot files directly:"}
            </p>
            <div
              onDragOver={e => { e.preventDefault(); setScreenshotsDragging(true); }}
              onDragLeave={() => setScreenshotsDragging(false)}
              onDrop={e => { e.preventDefault(); setScreenshotsDragging(false); handleScreenshotUpload(e.dataTransfer.files); }}
              onClick={() => screenshotInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                screenshotsDragging ? "border-blue-500 bg-blue-950/20" : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/40"
              }`}
            >
              <input
                ref={screenshotInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleScreenshotUpload(e.target.files)}
              />
              <p className="text-zinc-400 text-sm">{screenshotsDragging ? "Drop screenshots here" : "Drop or click to upload screenshots"}</p>
              <p className="text-xs text-zinc-600 mt-1">PNG, JPG, BMP, GIF</p>
            </div>
            {uploadResult && (
              <p className="text-xs mt-2 text-zinc-400">{uploadResult}</p>
            )}
          </div>
        </div>
      </div>

      {/* Sync reminder */}
      {authenticated && (
        <div className="border-t border-zinc-800 pt-6 mb-8">
          <p className="text-sm font-medium text-zinc-300 mb-1">Sync reminder</p>
          <p className="text-xs text-zinc-500 mb-3">
            A reminder appears in the navigation when neither game data nor screenshots have been updated within the selected interval.
          </p>
          <div className="flex flex-wrap gap-2">
            {REMINDER_OPTIONS.map((opt) => (
              <button
                key={String(opt.days)}
                onClick={() => handleReminderChange(opt.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  reminderDays === opt.days
                    ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {status === "done" && (
        <div className="space-y-4">
          <div className="bg-green-950/30 border border-green-800 rounded-xl p-4">
            <p className="text-green-400 text-sm font-medium">Import complete</p>
            {changes.length === 0 && (
              <p className="text-xs text-zinc-500 mt-1">No changes detected.</p>
            )}
          </div>

          {changes.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <p className="text-xs font-medium text-zinc-400">
                  {changes.length} change{changes.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="divide-y divide-zinc-800">
                {changes.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 text-sm text-zinc-200 truncate">{c.title}</span>
                    {c.type === "added" && (
                      <span className="text-xs text-green-400 font-medium shrink-0">New</span>
                    )}
                    {c.type === "playtime" && (
                      <span className="text-xs text-zinc-400 shrink-0 tabular-nums">
                        {c.before} min → <span className="text-zinc-200">{c.after} min</span>
                      </span>
                    )}
                    {c.type === "status" && (
                      <span className="text-xs text-zinc-400 shrink-0">
                        {c.before} → <span className="text-zinc-200">{c.after}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => router.push("/")}
            className="w-full py-2.5 bg-zinc-700 hover:bg-zinc-600 text-sm text-zinc-100 rounded-lg transition-colors"
          >
            Back to collection
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-4">
          <p className="text-red-400 text-sm font-medium mb-1">Import failed</p>
          <p className="text-xs text-zinc-400 mb-3">{error}</p>
          {output && (
            <pre className="text-xs text-zinc-500 whitespace-pre-wrap font-mono overflow-x-auto">
              {output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
