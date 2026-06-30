interface CartridgeSVGProps {
  platform: "GB" | "GBC" | "GBA" | "GBP";
  labelSrc: string | null;
  className?: string;
  thumb?: boolean; // serve downsampled thumbnail instead of full image
}

// GB/GBC: portrait shell 940×1064, label well measured from gb-cartridge-shell.png
const GB_WELL = { x: 130, y: 316, w: 678, h: 598, rx: 20 } as const;
const GB_W = 940;
const GB_H = 1064;

// GBA: physical cart 5.9cm×3.4cm → scale 966/5.9 = 163.7 px/cm
// ViewBox 966×557 matches physical proportions exactly.
// Shell image (966×440) is stretched to fill 966×557 (corrects horizontal distortion).
// Label: left 0.8cm, top 0.8cm, w 4.3cm, h 2.0cm → x=131, y=131, w=704, h=327
const GBA_WELL = { x: 131, y: 147, w: 704, h: 327, rx: 28 } as const;
const GBA_W = 966;
const GBA_H = 557;

function GBCartridge({ labelSrc, shell }: { labelSrc: string | null; shell: string }) {
  const clipId = `gb-lc-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg
      viewBox={`0 0 ${GB_W} ${GB_H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={GB_WELL.x} y={GB_WELL.y} width={GB_WELL.w} height={GB_WELL.h} rx={GB_WELL.rx} />
        </clipPath>
      </defs>
      <image href={shell} x="0" y="0" width={GB_W} height={GB_H} />
      {labelSrc && (
        <image
          href={labelSrc}
          x={GB_WELL.x} y={GB_WELL.y}
          width={GB_WELL.w} height={GB_WELL.h}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      )}
    </svg>
  );
}

function GBACartridge({ labelSrc }: { labelSrc: string | null }) {
  const clipId = `gba-lc-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg
      viewBox={`0 0 ${GBA_W} ${GBA_H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={GBA_WELL.x} y={GBA_WELL.y} width={GBA_WELL.w} height={GBA_WELL.h} rx={GBA_WELL.rx} />
        </clipPath>
      </defs>
      {/* Shell image stretched to fill corrected viewBox (fixes horizontal distortion) */}
      <image href="/images/gba-cartridge-shell.png" x="0" y="0" width={GBA_W} height={GBA_H} preserveAspectRatio="none" />
      {labelSrc && (
        <image
          href={labelSrc}
          x={GBA_WELL.x} y={GBA_WELL.y}
          width={GBA_WELL.w} height={GBA_WELL.h}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      )}
    </svg>
  );
}

function toThumbUrl(src: string | null, thumb: boolean): string | null {
  if (!src || !thumb) return src;
  // Only thumbnail our own cartridge images (/images/cartridges/...)
  const match = src.match(/^\/images\/cartridges\/(.+)$/);
  if (!match) return src;
  return `/images/cartridges/${match[1]}?thumb=1`;
}

export default function CartridgeSVG({ platform, labelSrc, className = "w-full h-full", thumb = false }: CartridgeSVGProps) {
  const shell =
    platform === "GBC" ? "/images/gbc-cartridge-shell.png" : "/images/gb-cartridge-shell.png";
  const src = toThumbUrl(labelSrc, thumb);

  return (
    <div className={className}>
      {platform === "GBA" ? (
        <GBACartridge labelSrc={src} />
      ) : (
        <GBCartridge labelSrc={src} shell={shell} />
      )}
    </div>
  );
}
