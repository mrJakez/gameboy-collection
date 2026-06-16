"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SyncChange {
  title: string;
  type: "added" | "playtime" | "status";
  before?: string;
  after?: string;
}

export default function PocketSyncPage() {
  const router = useRouter();
  const [lastSync, setLastSync] = useState<string | null | undefined>(undefined);
  const [listFile, setListFile] = useState<File | null>(null);
  const [playtimesFile, setPlaytimesFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [changes, setChanges] = useState<SyncChange[]>([]);
  const listRef = useRef<HTMLInputElement>(null);
  const playtimesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/sync-status").then(r => r.json()).then(d => setLastSync(d.syncedAt ?? null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
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
    } else {
      setStatus("error");
      setError(data.error ?? "Unknown error");
      setOutput(data.output ?? "");
    }
  }

  const ready = listFile && playtimesFile;

  return (
    <div className="max-w-xl">
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
      <p className="text-xs text-zinc-500 mb-6">
        Import play times and games from your Analogue Pocket SD card.
      </p>

      {/* Hint box */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 mb-6 text-sm text-zinc-400">
        <p className="font-medium text-zinc-300 mb-2">Where to find the files?</p>
        <p className="mb-1">On your Analogue Pocket SD card under:</p>
        <code className="block bg-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono mt-2">
          System/Played Games/list.bin<br />
          System/Played Games/playtimes.bin
        </code>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* list.bin */}
        <div
          onClick={() => listRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            listFile
              ? "border-green-600 bg-green-950/20"
              : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/40"
          }`}
        >
          <input
            ref={listRef}
            type="file"
            accept=".bin"
            className="hidden"
            onChange={(e) => setListFile(e.target.files?.[0] ?? null)}
          />
          {listFile ? (
            <>
              <p className="text-green-400 text-sm font-medium">✓ {listFile.name}</p>
              <p className="text-xs text-zinc-500 mt-1">{(listFile.size / 1024).toFixed(1)} KB</p>
            </>
          ) : (
            <>
              <p className="text-zinc-400 text-sm">Select list.bin</p>
              <p className="text-xs text-zinc-600 mt-1">Click to browse</p>
            </>
          )}
        </div>

        {/* playtimes.bin */}
        <div
          onClick={() => playtimesRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            playtimesFile
              ? "border-green-600 bg-green-950/20"
              : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/40"
          }`}
        >
          <input
            ref={playtimesRef}
            type="file"
            accept=".bin"
            className="hidden"
            onChange={(e) => setPlaytimesFile(e.target.files?.[0] ?? null)}
          />
          {playtimesFile ? (
            <>
              <p className="text-green-400 text-sm font-medium">✓ {playtimesFile.name}</p>
              <p className="text-xs text-zinc-500 mt-1">{(playtimesFile.size / 1024).toFixed(1)} KB</p>
            </>
          ) : (
            <>
              <p className="text-zinc-400 text-sm">Select playtimes.bin</p>
              <p className="text-xs text-zinc-600 mt-1">Click to browse</p>
            </>
          )}
        </div>

        <button
          type="submit"
          disabled={!ready || status === "uploading"}
          className="w-full py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-zinc-100 rounded-lg transition-colors"
        >
          {status === "uploading" ? "Importing…" : "Import"}
        </button>
      </form>

      {/* Result */}
      {status === "done" && (
        <div className="mt-6 space-y-4">
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
        <div className="mt-6 bg-red-950/30 border border-red-800 rounded-xl p-4">
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
