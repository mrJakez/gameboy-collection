"use client";

import { useRef, useState } from "react";

export type Box = { x1: number; y1: number; x2: number; y2: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MIN = 0.05; // minimum crop size as a fraction

type Mode = "move" | "nw" | "ne" | "sw" | "se";

export default function CropEditor({
  src,
  initial,
  busy,
  onCancel,
  onConfirm,
}: {
  src: string;
  initial: Box;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (box: Box) => void;
}) {
  const [box, setBox] = useState<Box>(initial);
  const ref = useRef<HTMLDivElement>(null);

  function startDrag(mode: Mode, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = e.clientX, startY = e.clientY;
    const start = { ...box };

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      const n: Box = { ...start };
      if (mode === "move") {
        const w = start.x2 - start.x1;
        const h = start.y2 - start.y1;
        const nx1 = clamp(start.x1 + dx, 0, 1 - w);
        const ny1 = clamp(start.y1 + dy, 0, 1 - h);
        n.x1 = nx1; n.y1 = ny1; n.x2 = nx1 + w; n.y2 = ny1 + h;
      } else {
        if (mode.includes("w")) n.x1 = clamp(start.x1 + dx, 0, start.x2 - MIN);
        if (mode.includes("e")) n.x2 = clamp(start.x2 + dx, start.x1 + MIN, 1);
        if (mode.includes("n")) n.y1 = clamp(start.y1 + dy, 0, start.y2 - MIN);
        if (mode.includes("s")) n.y2 = clamp(start.y2 + dy, start.y1 + MIN, 1);
      }
      setBox(n);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const pct = (v: number) => `${v * 100}%`;
  const handleCls = "absolute w-4 h-4 bg-white border border-zinc-500 rounded-full -translate-x-1/2 -translate-y-1/2";

  return (
    <div>
      <div ref={ref} className="relative overflow-hidden rounded-xl select-none" style={{ touchAction: "none" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Uploaded cartridge" className="block w-full h-auto" draggable={false} />

        {/* Darkened area outside the crop box */}
        <div
          className="absolute border-2 border-white/90"
          style={{
            left: pct(box.x1),
            top: pct(box.y1),
            width: pct(box.x2 - box.x1),
            height: pct(box.y2 - box.y1),
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            cursor: "move",
          }}
          onPointerDown={(e) => startDrag("move", e)}
        >
          <span className={handleCls} style={{ left: 0, top: 0, cursor: "nwse-resize" }} onPointerDown={(e) => startDrag("nw", e)} />
          <span className={handleCls} style={{ left: "100%", top: 0, cursor: "nesw-resize" }} onPointerDown={(e) => startDrag("ne", e)} />
          <span className={handleCls} style={{ left: 0, top: "100%", cursor: "nesw-resize" }} onPointerDown={(e) => startDrag("sw", e)} />
          <span className={handleCls} style={{ left: "100%", top: "100%", cursor: "nwse-resize" }} onPointerDown={(e) => startDrag("se", e)} />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onConfirm(box)}
          disabled={busy}
          className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-sm text-zinc-100 rounded-lg transition-colors"
        >
          {busy ? "…" : "Use this crop"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
