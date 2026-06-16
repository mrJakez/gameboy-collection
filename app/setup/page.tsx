"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import GameBoyIcon from "@/app/components/GameBoyIcon";

// ─── File drop zone for XML files ────────────────────────────────────────────

interface XmlZoneProps {
  label: string;
  file: File | null;
  dragging: boolean;
  onFile: (f: File) => void;
  onDragChange: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function XmlZone({ label, file, dragging, onFile, onDragChange, inputRef }: XmlZoneProps) {
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

// ─── File drop zone for .bin files ───────────────────────────────────────────

interface BinZoneProps {
  label: string;
  hint: string;
  file: File | null;
  dragging: boolean;
  onFile: (f: File) => void;
  onDragChange: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function BinZone({ label, hint, file, dragging, onFile, onDragChange, inputRef }: BinZoneProps) {
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); onDragChange(true); }}
      onDragLeave={() => onDragChange(false)}
      onDrop={(e) => { e.preventDefault(); onDragChange(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
        dragging ? "border-blue-500 bg-blue-950/20"
        : file ? "border-green-600 bg-green-950/20"
        : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/40"
      }`}
    >
      <input ref={inputRef} type="file" accept=".bin" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {file ? (
        <>
          <p className="text-green-400 text-sm font-medium">✓ {file.name}</p>
          <p className="text-xs text-zinc-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
        </>
      ) : (
        <>
          <p className="text-zinc-400 text-sm">{dragging ? `Drop ${label} here` : `Select ${label}`}</p>
          <p className="text-xs text-zinc-600 mt-1">{hint}</p>
        </>
      )}
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: { label: string; done: boolean }[] }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <>
          <div key={i} className={`flex items-center gap-2 text-xs font-medium ${i + 1 === current ? "text-zinc-100" : "text-zinc-500"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
              s.done ? "bg-green-600 text-white"
              : i + 1 === current ? "bg-zinc-100 text-zinc-900"
              : "bg-zinc-700 text-zinc-400"
            }`}>{s.done ? "✓" : i + 1}</span>
            <span className="whitespace-nowrap">{s.label}</span>
          </div>
          {i < steps.length - 1 && <div key={`line-${i}`} className="flex-1 h-px bg-zinc-800 mx-1" />}
        </>
      ))}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LibraryStatus { hasImages: boolean; total: number; converted: number; }
interface SyncChange { title: string; type: "added" | "playtime" | "status"; before?: string; after?: string; }

type Step = "xml" | "library" | "pocket";
type XmlStatus = "idle" | "loading" | "done" | "error";
type LibConvertStatus = "idle" | "converting" | "done";
type PocketStatus = "idle" | "uploading" | "done" | "error";

// ─── Password gate ────────────────────────────────────────────────────────────

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (res.ok) { onUnlock(); }
    else { setError("Wrong password"); setLoading(false); }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-zinc-100">Re-run Setup</h2>
      <p className="text-sm text-zinc-400">Setup has already been completed. Enter your admin password to continue.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Admin password"
          autoFocus
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={!pw || loading}
          className="w-full py-2.5 bg-zinc-100 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-zinc-900 text-sm font-medium rounded-lg transition-colors">
          {loading ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();

  // Auth gate
  const [gateState, setGateState] = useState<"checking" | "locked" | "unlocked">("checking");

  useEffect(() => {
    Promise.all([
      fetch("/api/setup").then(r => r.json()),
      fetch("/api/auth").then(r => r.json()),
    ]).then(([setup, auth]) => {
      if (!setup.exists) { setGateState("unlocked"); return; }        // first run
      if (auth.authenticated) { setGateState("unlocked"); return; }   // already logged in
      setGateState("locked");
    });
  }, []);

  // Step 1
  const [gbFile, setGbFile] = useState<File | null>(null);
  const [gbcFile, setGbcFile] = useState<File | null>(null);
  const [gbaFile, setGbaFile] = useState<File | null>(null);
  const [gbDrag, setGbDrag] = useState(false);
  const [gbcDrag, setGbcDrag] = useState(false);
  const [gbaDrag, setGbaDrag] = useState(false);
  const [xmlStatus, setXmlStatus] = useState<XmlStatus>("idle");
  const [xmlResult, setXmlResult] = useState<{ total: number; counts: Record<string, number> } | null>(null);
  const [xmlError, setXmlError] = useState("");
  const gbRef = useRef<HTMLInputElement>(null);
  const gbcRef = useRef<HTMLInputElement>(null);
  const gbaRef = useRef<HTMLInputElement>(null);

  // Step 2
  const [step, setStep] = useState<Step>("xml");
  const [libStatus, setLibStatus] = useState<LibraryStatus | null>(null);
  const [libConvert, setLibConvert] = useState<LibConvertStatus>("idle");
  const [libProgress, setLibProgress] = useState(0);
  const [libDone, setLibDone] = useState(0);
  const [libTotal, setLibTotal] = useState(0);

  // Step 3
  const [listFile, setListFile] = useState<File | null>(null);
  const [playtimesFile, setPlaytimesFile] = useState<File | null>(null);
  const [listDrag, setListDrag] = useState(false);
  const [playtimesDrag, setPlaytimesDrag] = useState(false);
  const [pocketStatus, setPocketStatus] = useState<PocketStatus>("idle");
  const [pocketChanges, setPocketChanges] = useState<SyncChange[]>([]);
  const [pocketError, setPocketError] = useState("");
  const listRef = useRef<HTMLInputElement>(null);
  const playtimesRef = useRef<HTMLInputElement>(null);

  const anyXml = gbFile || gbcFile || gbaFile;

  async function handleXmlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!anyXml) return;
    setXmlStatus("loading");
    setXmlError("");
    const fd = new FormData();
    if (gbFile) fd.append("gb", gbFile);
    if (gbcFile) fd.append("gbc", gbcFile);
    if (gbaFile) fd.append("gba", gbaFile);
    const res = await fetch("/api/setup", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) { setXmlResult(data); setXmlStatus("done"); }
    else { setXmlError(data.error ?? "Unknown error"); setXmlStatus("error"); }
  }

  async function goToLibraryStep() {
    const res = await fetch("/api/setup/library");
    setLibStatus(await res.json());
    setStep("library");
  }

  async function startConversion() {
    setLibConvert("converting");
    setLibProgress(0); setLibDone(0);
    const res = await fetch("/api/setup/library", { method: "POST" });
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const msg = JSON.parse(line.slice(6));
          if (msg.type === "start") setLibTotal(msg.total);
          if (msg.type === "progress" || msg.type === "done") {
            setLibDone(msg.done); setLibTotal(msg.total);
            setLibProgress(msg.total > 0 ? msg.done / msg.total : 0);
          }
          if (msg.type === "done") setLibConvert("done");
        } catch { /* ignore */ }
      }
    }
    setLibConvert("done"); setLibProgress(1);
  }

  async function handlePocketSync(e: React.FormEvent) {
    e.preventDefault();
    if (!listFile || !playtimesFile) return;
    setPocketStatus("uploading"); setPocketError(""); setPocketChanges([]);
    const fd = new FormData();
    fd.append("list", listFile);
    fd.append("playtimes", playtimesFile);
    const res = await fetch("/api/pocket-sync", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) { setPocketStatus("done"); setPocketChanges(data.changes ?? []); }
    else { setPocketStatus("error"); setPocketError(data.error ?? "Unknown error"); }
  }

  const stepsDone = { xml: xmlStatus === "done", library: libConvert === "done", pocket: pocketStatus === "done" };
  const stepNum = step === "xml" ? 1 : step === "library" ? 2 : 3;

  if (gateState === "checking") return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">

        <div className="flex items-center gap-3 mb-8">
          <GameBoyIcon className="h-10 w-auto text-zinc-100" />
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Game Boy Collection</h1>
            <p className="text-xs text-zinc-500">Initial Setup</p>
          </div>
        </div>

        {gateState === "locked" ? (
          <>
            <PasswordGate onUnlock={() => setGateState("unlocked")} />
            <p className="text-center text-xs text-zinc-600 mt-4">
              You can re-run setup anytime at <span className="font-mono">/setup</span>
            </p>
          </>
        ) : (<>

        <StepIndicator current={stepNum} steps={[
          { label: "No-Intro Database", done: stepsDone.xml },
          { label: "Library Images", done: stepsDone.library },
          { label: "Pocket Sync", done: stepsDone.pocket },
        ]} />

        {/* ── Step 1: XML ─────────────────────────────────────────────────── */}
        {step === "xml" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-zinc-100 mb-1">Import No-Intro Database</h2>
            <p className="text-sm text-zinc-400 mb-3">
              Three XML files are needed — one each for Game Boy, Game Boy Color and Game Boy Advance.
              They map cartridge IDs to game titles and are required for the Pocket Sync to work correctly.
            </p>
            <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-lg px-4 py-3 mb-4 space-y-1.5 text-xs text-zinc-400">
              <p><span className="text-zinc-200 font-medium">Why import this database?</span></p>
              <p>The No-Intro database contains a complete list of all known Game Boy, Game Boy Color and Game Boy Advance titles. Once imported, these games are automatically available in your collection — you can simply select them instead of entering titles manually.</p>
              <p>It also enables automatic artwork mapping: library images that can optionally be stored on the Analogue Pocket will be matched to the correct game title automatically.</p>
            </div>
            <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 mb-5 space-y-2">
              <p className="text-xs font-semibold text-zinc-300 mb-1">How to download the files</p>
              <ol className="space-y-1.5 text-xs text-zinc-400 list-none">
                <li><span className="inline-block w-5 text-zinc-500 font-mono">1.</span> Go to <a href="https://datomatic.no-intro.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">datomatic.no-intro.org</a></li>
                <li><span className="inline-block w-5 text-zinc-500 font-mono">2.</span> Click <span className="text-zinc-200 font-medium">Download</span> in the top navigation</li>
                <li><span className="inline-block w-5 text-zinc-500 font-mono">3.</span> Select <span className="text-zinc-200 font-medium">DB</span> as the download type</li>
                <li><span className="inline-block w-5 text-zinc-500 font-mono">4.</span> Choose system <span className="text-zinc-200 font-medium">Nintendo - Game Boy</span>, click <span className="text-zinc-200 font-medium">Prepare</span>, then <span className="text-zinc-200 font-medium">Download</span></li>
                <li><span className="inline-block w-5 text-zinc-500 font-mono">5.</span> Repeat for <span className="text-zinc-200 font-medium">Nintendo - Game Boy Color</span></li>
                <li><span className="inline-block w-5 text-zinc-500 font-mono">6.</span> Repeat for <span className="text-zinc-200 font-medium">Nintendo - Game Boy Advance</span></li>
              </ol>
            </div>

            {xmlStatus === "done" && xmlResult ? (
              <div className="space-y-4">
                <div className="bg-green-950/30 border border-green-800 rounded-xl p-4">
                  <p className="text-green-400 font-medium text-sm mb-2">Database created successfully</p>
                  <div className="space-y-1 text-xs text-zinc-400">
                    {xmlResult.counts.gb && <p>Game Boy: {xmlResult.counts.gb.toLocaleString()} entries</p>}
                    {xmlResult.counts.gbc && <p>Game Boy Color: {xmlResult.counts.gbc.toLocaleString()} entries</p>}
                    {xmlResult.counts.gba && <p>Game Boy Advance: {xmlResult.counts.gba.toLocaleString()} entries</p>}
                    <p className="text-zinc-300 font-medium pt-1">Total: {xmlResult.total.toLocaleString()} games</p>
                  </div>
                </div>
                <button onClick={goToLibraryStep}
                  className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium rounded-lg transition-colors">
                  Continue: Set up library images →
                </button>
              </div>
            ) : (
              <form onSubmit={handleXmlSubmit} className="space-y-3">
                <XmlZone label="Nintendo - Game Boy" file={gbFile} dragging={gbDrag} onFile={setGbFile} onDragChange={setGbDrag} inputRef={gbRef} />
                <XmlZone label="Nintendo - Game Boy Color" file={gbcFile} dragging={gbcDrag} onFile={setGbcFile} onDragChange={setGbcDrag} inputRef={gbcRef} />
                <XmlZone label="Nintendo - Game Boy Advance" file={gbaFile} dragging={gbaDrag} onFile={setGbaFile} onDragChange={setGbaDrag} inputRef={gbaRef} />
                {xmlStatus === "error" && <p className="text-sm text-red-400">{xmlError}</p>}
                <button type="submit" disabled={!anyXml || xmlStatus === "loading"}
                  className="w-full py-2.5 bg-zinc-100 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-zinc-900 text-sm font-medium rounded-lg transition-colors mt-2">
                  {xmlStatus === "loading" ? "Processing…" : "Generate Database"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Step 2: Library images ───────────────────────────────────────── */}
        {step === "library" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-zinc-100">Library Images</h2>
            <p className="text-sm text-zinc-400">
              The Analogue Pocket stores small game screenshots as <span className="font-mono text-zinc-300">.bin</span> files on the SD card.
              These are converted to PNG and used as game thumbnails throughout the app.
            </p>

            {libStatus && !libStatus.hasImages && (
              <div className="bg-yellow-950/30 border border-yellow-700/60 rounded-xl p-4 space-y-2 text-xs text-zinc-400">
                <p className="text-yellow-400 font-medium text-sm">No library images found</p>
                <p>Copy the <span className="font-mono text-zinc-300">Library/</span> folder from your Analogue Pocket SD card into <span className="font-mono text-zinc-300">analogue-pocket-library/</span>.</p>
                <p>You can find it at <span className="font-mono text-zinc-300">System/Library/</span> on the SD card.</p>
                <p className="pt-1">Don't have the files? Search for <span className="text-zinc-200 font-medium">analogue pocket library not working</span> on Google — the community has resources for obtaining the library image set.</p>
              </div>
            )}

            {libStatus && libStatus.hasImages && libConvert === "idle" && (
              <div className="space-y-4">
                <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 text-xs text-zinc-400 space-y-1">
                  <p><span className="text-zinc-200 font-medium">{libStatus.total.toLocaleString()}</span> library images found</p>
                  {libStatus.converted > 0 && (
                    <p><span className="text-green-400">{libStatus.converted.toLocaleString()}</span> already converted — only new images will be processed</p>
                  )}
                </div>
                <button onClick={startConversion}
                  className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium rounded-lg transition-colors">
                  Convert library images
                </button>
              </div>
            )}

            {libConvert === "converting" && (
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Converting images…</span>
                  <span>{libDone.toLocaleString()} / {libTotal.toLocaleString()}</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-zinc-100 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(libProgress * 100)}%` }} />
                </div>
                <p className="text-xs text-zinc-500 text-center">{Math.round(libProgress * 100)}%</p>
              </div>
            )}

            {libConvert === "done" && (
              <div className="bg-green-950/30 border border-green-800 rounded-xl p-4">
                <p className="text-green-400 font-medium text-sm">{libTotal.toLocaleString()} images converted successfully</p>
              </div>
            )}

            {(libConvert === "done" || (libStatus && !libStatus.hasImages)) && (
              <button onClick={() => setStep("pocket")}
                className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium rounded-lg transition-colors">
                Continue: Import Pocket data →
              </button>
            )}
            {libStatus && !libStatus.hasImages && libConvert === "idle" && (
              <button onClick={() => setStep("pocket")}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors">
                Skip for now
              </button>
            )}
          </div>
        )}

        {/* ── Step 3: Pocket Sync ──────────────────────────────────────────── */}
        {step === "pocket" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-zinc-100">Import Pocket Data</h2>
            <p className="text-sm text-zinc-400">
              Import your play history and game list directly from the Analogue Pocket SD card.
              This adds games you've played and syncs playtimes to your collection.
            </p>

            <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 text-xs text-zinc-400 space-y-2">
              <p className="font-medium text-zinc-300">Where to find the files</p>
              <p>On your Analogue Pocket SD card under:</p>
              <code className="block bg-zinc-800 rounded-lg px-3 py-2 text-zinc-300 font-mono mt-1">
                System/Played Games/list.bin<br />
                System/Played Games/playtimes.bin
              </code>
            </div>

            {pocketStatus !== "done" && (
              <form onSubmit={handlePocketSync} className="space-y-3">
                <BinZone label="list.bin" hint="Click to browse or drag & drop"
                  file={listFile} dragging={listDrag}
                  onFile={setListFile} onDragChange={setListDrag} inputRef={listRef} />
                <BinZone label="playtimes.bin" hint="Click to browse or drag & drop"
                  file={playtimesFile} dragging={playtimesDrag}
                  onFile={setPlaytimesFile} onDragChange={setPlaytimesDrag} inputRef={playtimesRef} />

                {pocketStatus === "error" && (
                  <p className="text-sm text-red-400">{pocketError}</p>
                )}

                <button type="submit" disabled={!listFile || !playtimesFile || pocketStatus === "uploading"}
                  className="w-full py-2.5 bg-zinc-100 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-zinc-900 text-sm font-medium rounded-lg transition-colors">
                  {pocketStatus === "uploading" ? "Importing…" : "Import"}
                </button>
              </form>
            )}

            {pocketStatus === "done" && (
              <div className="space-y-3">
                <div className="bg-green-950/30 border border-green-800 rounded-xl p-4">
                  <p className="text-green-400 font-medium text-sm">Import complete</p>
                  {pocketChanges.length === 0 && (
                    <p className="text-xs text-zinc-500 mt-1">No changes detected.</p>
                  )}
                </div>
                {pocketChanges.length > 0 && (
                  <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-zinc-700">
                      <p className="text-xs font-medium text-zinc-400">{pocketChanges.length} change{pocketChanges.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="divide-y divide-zinc-800 max-h-48 overflow-y-auto">
                      {pocketChanges.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2">
                          <span className="flex-1 text-xs text-zinc-200 truncate">{c.title}</span>
                          {c.type === "added" && <span className="text-xs text-green-400 shrink-0">New</span>}
                          {c.type === "playtime" && <span className="text-xs text-zinc-400 shrink-0 tabular-nums">{c.before} → <span className="text-zinc-200">{c.after} min</span></span>}
                          {c.type === "status" && <span className="text-xs text-zinc-400 shrink-0">{c.before} → <span className="text-zinc-200">{c.after}</span></span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => router.push("/")}
                className="flex-1 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium rounded-lg transition-colors">
                Go to collection →
              </button>
              {pocketStatus !== "done" && (
                <button onClick={() => router.push("/")}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors">
                  Skip for now
                </button>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-zinc-600 mt-4">
          You can re-run setup anytime at <span className="font-mono">/setup</span>
        </p>
        </>)}
      </div>
    </div>
  );
}
