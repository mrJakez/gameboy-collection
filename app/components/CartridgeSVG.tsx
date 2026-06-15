interface CartridgeSVGProps {
  platform: "GB" | "GBC" | "GBA" | "GBP";
  labelSrc: string | null;
  className?: string;
}

// Recessed label well within the trimmed 940×1064 cartridge-shell.png template.
// Background made transparent and cropped to the cartridge silhouette (8px margin).
const WELL = { x: 130, y: 316, w: 678, h: 598, rx: 20 } as const;
const CANVAS_W = 940;
const CANVAS_H = 1064;

function GBCartridge({ labelSrc }: { labelSrc: string | null }) {
  const clipId = `gb-lc-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={WELL.x} y={WELL.y} width={WELL.w} height={WELL.h} rx={WELL.rx} />
        </clipPath>
      </defs>

      {/* Full cartridge template (gray plastic + transparent background + empty well) */}
      <image href="/images/cartridge-shell.png" x="0" y="0" width={CANVAS_W} height={CANVAS_H} />

      {/* Label sticker placed into the recessed well — plastic frame surrounds it naturally */}
      {labelSrc && (
        <image
          href={labelSrc}
          x={WELL.x} y={WELL.y}
          width={WELL.w} height={WELL.h}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      )}
    </svg>
  );
}

// GBA uses the same shell template for now (same visual language)
function GBACartridge({ labelSrc }: { labelSrc: string | null }) {
  return <GBCartridge labelSrc={labelSrc} />;
}

export default function CartridgeSVG({ platform, labelSrc, className = "w-full h-full" }: CartridgeSVGProps) {
  return (
    <div className={className}>
      {platform === "GBA" ? (
        <GBACartridge labelSrc={labelSrc} />
      ) : (
        <GBCartridge labelSrc={labelSrc} />
      )}
    </div>
  );
}
