import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import zlib from "zlib";

const LIBRARY_DIR = "/analogue-pocket-library/Images";
const PUBLIC_LIBRARY = path.join(process.cwd(), "data", "library-images");

const PLATFORM_DIMS: Record<string, [number, number]> = {
  GB: [160, 144],
  GBC: [160, 144],
  GBA: [240, 160],
};

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
  const compressed = zlib.deflateSync(raw);

  return Buffer.concat([
    Buffer.from("\x89PNG\r\n\x1a\n", "binary"),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function findBin(crc: string): { binPath: string; platform: string } | null {
  for (const platform of ["GBA", "GBC", "GB"]) {
    const p = path.join(LIBRARY_DIR, platform, `${crc}.bin`);
    if (fs.existsSync(p)) return { binPath: p, platform };
  }
  return null;
}

function convertBin(binPath: string, platform: string): Buffer | null {
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
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  // Accept both "abc12345" and "abc12345.png"
  const crc = filename.replace(/\.png$/i, "");
  if (!/^[0-9a-f]{8}$/i.test(crc)) {
    return new NextResponse(null, { status: 400 });
  }

  // Serve pre-converted PNG from public/ if available
  const publicPng = path.join(PUBLIC_LIBRARY, `${crc}.png`);
  if (fs.existsSync(publicPng)) {
    const buf = fs.readFileSync(publicPng);
    return new NextResponse(buf, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  }

  // Convert on-the-fly from .bin
  const found = findBin(crc);
  if (!found) return new NextResponse(null, { status: 404 });

  const png = convertBin(found.binPath, found.platform);
  if (!png) return new NextResponse(null, { status: 422 });

  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
