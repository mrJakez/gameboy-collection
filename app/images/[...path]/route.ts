import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const rel = segments.join("/");
  const abs = path.join(process.cwd(), "data", rel);

  // Stay within data/
  if (!abs.startsWith(path.join(process.cwd(), "data"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(abs)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(abs).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const buf = fs.readFileSync(abs);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
