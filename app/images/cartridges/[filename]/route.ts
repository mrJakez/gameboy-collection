import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const dynamic = "force-dynamic";

const CARTRIDGES_DIR = path.join(process.cwd(), "data", "cartridges");
const CACHE_DIR = path.join(process.cwd(), "data", "cache", "cartridges");
const THUMB_WIDTH = 400;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const original = path.join(CARTRIDGES_DIR, filename);
  if (!fs.existsSync(original)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const thumb = req.nextUrl.searchParams.get("thumb") === "1";

  const serveFile = (filePath: string): NextResponse => {
    const buf = fs.readFileSync(filePath);
    const mtime = fs.statSync(filePath).mtimeMs;
    const etag = `"${mtime.toString(36)}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "X-Accel-Expires": "0",  // tell nginx not to cache this response
        "ETag": etag,
      },
    });
  };

  if (!thumb) {
    return serveFile(original);
  }

  // Serve cached thumbnail, generate on demand
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, filename);

  const forceRegen = req.nextUrl.searchParams.get("regenerate") === "1";
  const originalStat = fs.statSync(original);
  const cacheStat = fs.existsSync(cachePath) ? fs.statSync(cachePath) : null;
  const stale = forceRegen || !cacheStat || cacheStat.mtimeMs < originalStat.mtimeMs || cacheStat.size < 1024;

  if (stale) {
    await sharp(original)
      .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(cachePath);
  }

  return serveFile(cachePath);
}
