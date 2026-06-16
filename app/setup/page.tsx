"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import GameBoyIcon from "@/app/components/GameBoyIcon";

interface FileZoneProps {
  label: string;
  platform: string;
  file: File | null;
  dragging: boolean;
  onFile: (f: File) => void;
  onDragChange: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function FileZone({ label, file, dragging, onFile, onDragChange, inputRef }: FileZoneProps) {
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); onDragChange(true); }}
      onDragLeave={() => onDragChange(false)}
      onDrop={(e) => { e.preventDefault(); onDragChange(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
        dragging ? "border-blue-500 bg-blue-950/20"
        : file ? "border-green-600 bg-green-950/20"
        : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/40"
      }`}
    >
      <input ref={inputRef} type="file" accept=".xml,.dat" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <p className="text-xs font-medium text-zinc-500 mb-1">{label}</p>
      {file ? (
        <>
          <p className="text-sm font-medium text-green-400">✓ {file.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
        </>
      ) : (
        <>
          <p className="text-zinc-300 text-sm">{dragging ? "Drop here" : "Select .xml file"}</p>
          <p className="text-xs text-zinc-600 mt-0.5">Click or drag & drop</p>
        </>
      )}
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [gbFile, setGbFile] = useState<File | null>(null);
  const [gbcFile, setGbcFile] = useState<File | null>(null);
  const [gbaFile, setGbaFile] = useState<File | null>(null);
  const [gbDrag, setGbDrag] = useState(false);
  const [gbcDrag, setGbcDrag] = useState(false);
  const [gbaDrag, setGbaDrag] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ total: number; counts: Record<string, number> } | null>(null);
  const [error, setError] = useState("");
  const gbRef = useRef<HTMLInputElement>(null);
  const gbcRef = useRef<HTMLInputElement>(null);
  const gbaRef = useRef<HTMLInputElement>(null);

  const anyFile = gbFile || gbcFile || gbaFile;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!anyFile) return;
    setStatus("loading");
    setError("");

    const fd = new FormData();
    if (gbFile) fd.append("gb", gbFile);
    if (gbcFile) fd.append("gbc", gbcFile);
    if (gbaFile) fd.append("gba", gbaFile);

    const res = await fetch("/api/setup", { method: "POST", body: fd });
    const data = await res.json();

    if (res.ok) {
      setResult(data);
      setStatus("done");
    } else {
      setError(data.error ?? "Unknown error");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <GameBoyIcon className="h-10 w-auto text-zinc-100" />
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Game Boy Collection</h1>
            <p className="text-xs text-zinc-500">Initial Setup</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-zinc-100 mb-1">Import No-Intro Database</h2>
          <p className="text-sm text-zinc-400 mb-5">
            Upload the No-Intro XML export files for Game Boy, Game Boy Color and Game Boy Advance.
            These are used to match cartridge IDs to game titles.
            Download them from{" "}
            <a href="https://www.no-intro.org" target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:underline">no-intro.org</a>{" "}
            (free account required).
          </p>

          {status === "done" && result ? (
            <div className="space-y-4">
              <div className="bg-green-950/30 border border-green-800 rounded-xl p-4">
                <p className="text-green-400 font-medium text-sm mb-2">Database created successfully</p>
                <div className="space-y-1 text-xs text-zinc-400">
                  {result.counts.gb && <p>Game Boy: {result.counts.gb.toLocaleString()} entries</p>}
                  {result.counts.gbc && <p>Game Boy Color: {result.counts.gbc.toLocaleString()} entries</p>}
                  {result.counts.gba && <p>Game Boy Advance: {result.counts.gba.toLocaleString()} entries</p>}
                  <p className="text-zinc-300 font-medium pt-1">Total: {result.total.toLocaleString()} games</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/")}
                className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium rounded-lg transition-colors"
              >
                Go to collection →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <FileZone label="Nintendo - Game Boy" platform="gb" file={gbFile} dragging={gbDrag}
                onFile={setGbFile} onDragChange={setGbDrag} inputRef={gbRef} />
              <FileZone label="Nintendo - Game Boy Color" platform="gbc" file={gbcFile} dragging={gbcDrag}
                onFile={setGbcFile} onDragChange={setGbcDrag} inputRef={gbcRef} />
              <FileZone label="Nintendo - Game Boy Advance" platform="gba" file={gbaFile} dragging={gbaDrag}
                onFile={setGbaFile} onDragChange={setGbaDrag} inputRef={gbaRef} />

              {status === "error" && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={!anyFile || status === "loading"}
                className="w-full py-2.5 bg-zinc-100 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-zinc-900 text-sm font-medium rounded-lg transition-colors mt-2"
              >
                {status === "loading" ? "Processing…" : "Generate Database"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-zinc-600 mt-4">
          You can re-run setup anytime at <span className="font-mono">/setup</span>
        </p>
      </div>
    </div>
  );
}
