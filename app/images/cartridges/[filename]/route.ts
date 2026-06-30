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

  if (!thumb) {
    const buf = fs.readFileSync(original);
    return new NextResponse(buf, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
    });
  }

  // Serve cached thumbnail, generate on demand
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, filename);

  if (!fs.existsSync(cachePath)) {
    await sharp(original)
      .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(cachePath);
  }

  const buf = fs.readFileSync(cachePath);
  return new NextResponse(buf, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
  });
}
