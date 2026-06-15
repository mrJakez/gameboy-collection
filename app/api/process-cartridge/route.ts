import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";
import heicConvert from "heic-convert";
import fs from "fs";
import path from "path";
import { isAuthenticated } from "@/app/api/auth/route";

async function toJpegBuffer(buffer: Buffer, mimeType: string): Promise<Buffer> {
  // Convert HEIC/HEIF (iPhone default format) before passing to sharp
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    const rgb = await heicConvert({ buffer, format: "JPEG", quality: 0.85 });
    return Buffer.from(rgb);
  }
  // .rotate() with no args applies EXIF orientation so iPhone photos aren't sideways
  return sharp(buffer, { failOn: "none" }).rotate().jpeg({ quality: 85 }).toBuffer();
}

// Some GB labels print neutral gray bars around the artwork (and the label-bbox
// estimate can include a sliver of gray cartridge plastic). Trim near-uniform gray
// rows/columns inward from the requested sides so only the colourful art remains.
type Sides = { top: boolean; bottom: boolean; left: boolean; right: boolean };
async function trimBorders(input: Buffer, sides: Sides): Promise<Buffer> {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const chromaAt = (x: number, y: number): number => {
    const idx = (y * width + x) * channels;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    return Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
  };
  const colGray = (x: number): boolean => {
    let n = 0, s = 0;
    const step = Math.max(1, Math.floor(height / 80));
    for (let y = 0; y < height; y += step) { if (chromaAt(x, y) < 24) n++; s++; }
    return s > 0 && n / s > 0.9;
  };
  const rowGray = (y: number): boolean => {
    let n = 0, s = 0;
    const step = Math.max(1, Math.floor(width / 80));
    for (let x = 0; x < width; x += step) { if (chromaAt(x, y) < 24) n++; s++; }
    return s > 0 && n / s > 0.9;
  };

  const maxX = Math.floor(width * 0.35);  // safety: never eat more than 35% per side
  const maxY = Math.floor(height * 0.35);
  let l = 0, r = width - 1, t = 0, b = height - 1;
  if (sides.left) while (l < maxX && colGray(l)) l++;
  if (sides.right) while (r > width - 1 - maxX && r > l && colGray(r)) r--;
  if (sides.top) while (t < maxY && rowGray(t)) t++;
  if (sides.bottom) while (b > height - 1 - maxY && b > t && rowGray(b)) b--;

  const w = r - l + 1, h = b - t + 1;
  if (w <= 0 || h <= 0 || (l === 0 && r === width - 1 && t === 0 && b === height - 1)) return input;
  return sharp(input).extract({ left: l, top: t, width: w, height: h }).toBuffer();
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const gameId = formData.get("gameId") as string;
    const select = formData.get("select") as string | null;
    const crop = formData.get("crop") as string | null;
    const original = formData.get("original") as string | null;

    const dir = path.join(process.cwd(), "data", "cartridges");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Promote a buffer to the stable label file and remove all other leftovers for the game
    const promote = async (jpg: Buffer): Promise<string> => {
      const finalName = `${gameId}_label_${Date.now()}.jpg`;
      fs.writeFileSync(path.join(dir, finalName), jpg);
      const others = fs.readdirSync(dir).filter(
        (f) => f.startsWith(`${gameId}_`) && f !== finalName
      );
      for (const f of others) fs.unlinkSync(path.join(dir, f));
      return `/images/cartridges/${finalName}`;
    };

    // ── Selection step: promote the chosen candidate to the stable label, discard the rest ──
    if (select && gameId) {
      const src = path.join(dir, path.basename(select));
      if (!fs.existsSync(src)) {
        return NextResponse.json({ error: "Selected variant not found" }, { status: 404 });
      }
      const finalPath = await promote(fs.readFileSync(src));
      return NextResponse.json({ path: finalPath });
    }

    // ── Manual crop step: extract a user-drawn box from the saved original ──
    if (crop && original && gameId) {
      const origPath = path.join(dir, path.basename(original));
      if (!fs.existsSync(origPath)) {
        return NextResponse.json({ error: "Original image not found" }, { status: 404 });
      }
      const box = JSON.parse(crop) as { x1: number; y1: number; x2: number; y2: number };
      const meta = await sharp(origPath).metadata();
      const imgW = meta.width ?? 1000;
      const imgH = meta.height ?? 1000;
      const l = Math.max(0, Math.min(1, box.x1));
      const t = Math.max(0, Math.min(1, box.y1));
      const r = Math.max(l, Math.min(1, box.x2));
      const b = Math.max(t, Math.min(1, box.y2));
      const jpg = await sharp(origPath)
        .extract({
          left: Math.round(l * imgW),
          top: Math.round(t * imgH),
          width: Math.max(1, Math.round((r - l) * imgW)),
          height: Math.max(1, Math.round((b - t) * imgH)),
        })
        .jpeg({ quality: 90 })
        .toBuffer();
      const finalPath = await promote(jpg);
      return NextResponse.json({ path: finalPath });
    }

    if (!file || !gameId) {
      return NextResponse.json({ error: "Missing file or gameId" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let jpegBuffer: Buffer;
    try {
      jpegBuffer = await toJpegBuffer(buffer, file.type);
    } catch {
      return NextResponse.json(
        { error: "Could not read image. Please use JPEG or PNG." },
        { status: 422 }
      );
    }

    const base64 = jpegBuffer.toString("base64");
    const client = new OpenAI({ apiKey });

    let bbox: { x1: number; y1: number; x2: number; y2: number };

    try {
      // Step 1: find the cartridge BODY bounds (large gray plastic object — easy to detect)
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 128,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" },
              },
              {
                type: "text",
                text: `Find the outer boundary of the gray plastic Nintendo Game Boy cartridge in this photo (the full plastic body including the top oval ridge and the connector tabs at the bottom, but NOT the surrounding background).

Return ONLY valid JSON:
{ "x1": <left edge>, "y1": <top edge>, "x2": <right edge>, "y2": <bottom edge> }

Values are fractions of image width/height (0.0–1.0). No explanation, no markdown.`,
              },
            ],
          },
        ],
      });

      const text = response.choices[0]?.message?.content?.trim() ?? "";
      console.log("OpenAI cartridge body bbox:", text);
      const match = text.match(/\{[^}]+\}/);
      if (!match) throw new Error("No JSON in response");
      const body = JSON.parse(match[0]) as { x1: number; y1: number; x2: number; y2: number };
      console.log("Cartridge body:", body);

      const bw = body.x2 - body.x1;
      const bh = body.y2 - body.y1;

      // Step 2: derive label area from fixed GB-cartridge proportions
      // The label sticker sits below the oval ridge (~28% from top of body)
      // and above the connector notch (~18% from bottom of body).
      // Horizontally it has ~8% margin on each side of the body.
      // Physical GB cartridge: 5.7cm wide × 6.5cm high
      // Label sticker: 4.2cm wide × 3.8cm high, 0.6cm side margins, 1.0cm bottom margin
      bbox = {
        x1: body.x1 + bw * 0.132,  // (5.7 - 4.2) / (2 * 5.7)
        y1: body.y1 + bh * 0.262,  // (6.5 - 3.8 - 1.0) / 6.5
        x2: body.x2 - bw * 0.132,
        y2: body.y2 - bh * 0.154,  // 1.0 / 6.5
      };
      console.log("Derived label bbox:", bbox);
    } catch (err) {
      console.error("OpenAI vision error:", err);
      bbox = { x1: 0.12, y1: 0.32, x2: 0.88, y2: 0.78 };
    }

    const meta = await sharp(jpegBuffer).metadata();
    const imgW = meta.width ?? 1000;
    const imgH = meta.height ?? 1000;

    type Box = { x1: number; y1: number; x2: number; y2: number };
    const region = async (box: Box, pad = 0.008): Promise<Buffer> => {
      const l = Math.max(0, box.x1 - pad);
      const t = Math.max(0, box.y1 - pad);
      const r = Math.min(1, box.x2 + pad);
      const b = Math.min(1, box.y2 + pad);
      return sharp(jpegBuffer)
        .extract({
          left: Math.round(l * imgW),
          top: Math.round(t * imgH),
          width: Math.max(1, Math.round((r - l) * imgW)),
          height: Math.max(1, Math.round((b - t) * imgH)),
        })
        .toBuffer();
    };

    // A slightly wider horizontal crop, for labels that extend beyond the estimate
    const bbw = bbox.x2 - bbox.x1;
    const wideBox: Box = {
      x1: Math.max(0, bbox.x1 - bbw * 0.12),
      y1: bbox.y1,
      x2: Math.min(1, bbox.x2 + bbw * 0.12),
      y2: bbox.y2,
    };

    const baseRegion = await region(bbox);
    const wideRegion = await region(wideBox);

    // Generate a few candidate crops — the user picks the best one in the UI
    const variantDefs: { key: string; label: string; buf: Buffer }[] = [
      { key: "auto", label: "Auto", buf: await trimBorders(baseRegion, { top: false, bottom: false, left: true, right: true }) },
      { key: "full", label: "Full label", buf: baseRegion },
      { key: "tight", label: "Tight", buf: await trimBorders(baseRegion, { top: true, bottom: true, left: true, right: true }) },
      { key: "wide", label: "Wide", buf: await trimBorders(wideRegion, { top: false, bottom: false, left: true, right: true }) },
    ];

    const ts = Date.now();
    // Remove leftover candidates/originals from a previous (un-confirmed) upload for this
    // game, but keep the currently selected label (stable name, no _cand_/_orig_ marker).
    const stale = fs.readdirSync(dir).filter(
      (f) => f.startsWith(`${gameId}_`) && (f.includes("_cand_") || f.includes("_orig_"))
    );
    for (const f of stale) fs.unlinkSync(path.join(dir, f));

    // Save the full (EXIF-corrected) upload so the user can re-crop it manually
    const origName = `${gameId}_orig_${ts}.jpg`;
    fs.writeFileSync(path.join(dir, origName), jpegBuffer);

    const variants: { key: string; label: string; path: string }[] = [];
    for (let i = 0; i < variantDefs.length; i++) {
      const v = variantDefs[i];
      const jpg = await sharp(v.buf).jpeg({ quality: 90 }).toBuffer();
      const fn = `${gameId}_label_${ts}_cand_${i}.jpg`;
      fs.writeFileSync(path.join(dir, fn), jpg);
      variants.push({ key: v.key, label: v.label, path: `/images/cartridges/${fn}` });
    }

    return NextResponse.json({
      variants,
      original: `/images/cartridges/${origName}`,
      bbox,
    });
  } catch (err) {
    console.error("process-cartridge error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
