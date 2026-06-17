import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import zlib from "zlib";

const LIBRARY_IMAGES_DIR = fs.existsSync("/analogue-pocket-library/Images")
  ? "/analogue-pocket-library/Images"
  : path.join(process.cwd(), "analogue-pocket-library", "Images");

const PUBLIC_LIBRARY = path.join(process.cwd(), "data", "library-images");

const PLATFORM_DIMS: Record<string, [number, number]> = {
  GB: [160, 144],
  GBC: [160, 144],
  GBA: [240, 160],
};

// GET /api/setup/library — check status
export async function GET() {
  if (!fs.existsSync(LIBRARY_IMAGES_DIR)) {
    return NextResponse.json({ hasImages: false, total: 0, converted: 0 });
  }

  let total = 0;
  let converted = 0;
  for (const platform of ["GB", "GBC", "GBA"]) {
    const dir = path.join(LIBRARY_IMAGES_DIR, platform);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".bin")) {
        total++;
        if (fs.existsSync(path.join(PUBLIC_LIBRARY, f.replace(".bin", ".png")))) converted++;
      }
    }
  }

  return NextResponse.json({ hasImages: total > 0, total, converted });
}

function fixPixelOrder(raw: Buffer, width: number, height: number): Buffer {
  const out = Buffer.alloc(raw.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (x * height + y) * 4;
      const d = (y * width + (width - 1 - x)) * 4;
      raw.copy(out, d, s, s + 4);
    }
  }
  return out;
}

function encodePng(rgba: Buffer, width: number, height: number): Buffer {
  function chunk(name: string, data: Buffer): Buffer {
    const nameBytes = Buffer.from(name, "ascii");
    const body = Buffer.concat([nameBytes, data]);
    const crcVal = zlib.crc32(body);
    const out = Buffer.alloc(4 + 4 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    nameBytes.copy(out, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crcVal, 8 + data.length);
    return out;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from("\x89PNG\r\n\x1a\n", "binary"),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function convertBin(binPath: string, platform: string): Buffer | null {
  try {
    const data = fs.readFileSync(binPath);
    if (data.length < 9) return null;
    let width = data.readUInt16LE(4);
    let height = data.readUInt16LE(6);
    const expected = width * height * 4 + 8;
    if (data.length !== expected) {
      const [w, h] = PLATFORM_DIMS[platform] ?? [160, 144];
      if (data.length === w * h * 4 + 8) { width = w; height = h; }
      else return null;
    }
    const pixels = fixPixelOrder(data.subarray(8), width, height);
    return encodePng(pixels, width, height);
  } catch {
    return null;
  }
}

// POST /api/setup/library — convert with SSE progress stream
export async function POST(_req: NextRequest) {
  if (!fs.existsSync(LIBRARY_IMAGES_DIR)) {
    return NextResponse.json({ error: "No library images found." }, { status: 404 });
  }

  // Collect all .bin files
  const bins: { binPath: string; outPath: string; platform: string }[] = [];
  for (const platform of ["GB", "GBC", "GBA"]) {
    const dir = path.join(LIBRARY_IMAGES_DIR, platform);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".bin")) {
        bins.push({
          binPath: path.join(dir, f),
          outPath: path.join(PUBLIC_LIBRARY, f.replace(".bin", ".png")),
          platform,
        });
      }
    }
  }

  fs.mkdirSync(PUBLIC_LIBRARY, { recursive: true });

  const total = bins.length;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      send({ type: "start", total });

      let done = 0;
      let skipped = 0;
      const BATCH = 25;

      for (const { binPath, outPath, platform } of bins) {
        if (fs.existsSync(outPath)) {
          skipped++;
        } else {
          const png = convertBin(binPath, platform);
          if (png) fs.writeFileSync(outPath, png);
        }
        done++;

        if (done % BATCH === 0 || done === total) {
          send({ type: "progress", done, total, skipped });
          // yield to event loop so the chunk actually flushes
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      send({ type: "done", done: total, total, skipped });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
