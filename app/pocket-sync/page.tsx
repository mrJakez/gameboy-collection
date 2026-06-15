"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function PocketSyncPage() {
  const router = useRouter();
  const [listFile, setListFile] = useState<File | null>(null);
  const [playtimesFile, setPlaytimesFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef<HTMLInputElement>(null);
  const playtimesRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listFile || !playtimesFile) return;

    setStatus("uploading");
    setOutput("");
    setError("");

    const fd = new FormData();
    fd.append("list", listFile);
    fd.append("playtimes", playtimesFile);

    const res = await fetch("/api/pocket-sync", { method: "POST", body: fd });
    const data = await res.json();

    if (res.ok) {
      setStatus("done");
      setOutput(data.output ?? "");
    } else {
      setStatus("error");
      setError(data.error ?? "Unbekannter Fehler");
      setOutput(data.output ?? "");
    }
  }

  const ready = listFile && playtimesFile;

  return (
    <div className="max-w-xl">
      <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6 inline-block">
        ← Back
      </a>

      <h2 className="text-xl font-bold text-zinc-100 mb-1">Pocket Sync</h2>
      <p className="text-xs text-zinc-500 mb-6">
        Lädt Spielzeiten und Spiele von der Analogue Pocket SD-Karte.
      </p>

      {/* Hint box */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 mb-6 text-sm text-zinc-400">
        <p className="font-medium text-zinc-300 mb-2">Wo finde ich die Dateien?</p>
        <p className="mb-1">Auf der SD-Karte der Analogue Pocket unter:</p>
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
              <p className="text-zinc-400 text-sm">list.bin auswählen</p>
              <p className="text-xs text-zinc-600 mt-1">Klicken zum Durchsuchen</p>
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
              <p className="text-zinc-400 text-sm">playtimes.bin auswählen</p>
              <p className="text-xs text-zinc-600 mt-1">Klicken zum Durchsuchen</p>
            </>
          )}
        </div>

        <button
          type="submit"
          disabled={!ready || status === "uploading"}
          className="w-full py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-zinc-100 rounded-lg transition-colors"
        >
          {status === "uploading" ? "Wird importiert…" : "Importieren"}
        </button>
      </form>

      {/* Result */}
      {status === "done" && (
        <div className="mt-6 bg-green-950/30 border border-green-800 rounded-xl p-4">
          <p className="text-green-400 text-sm font-medium mb-3">Import abgeschlossen</p>
          {output && (
            <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono overflow-x-auto">
              {output}
            </pre>
          )}
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-sm text-zinc-100 rounded-lg transition-colors"
          >
            Zur Übersicht
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="mt-6 bg-red-950/30 border border-red-800 rounded-xl p-4">
          <p className="text-red-400 text-sm font-medium mb-1">Fehler beim Import</p>
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
