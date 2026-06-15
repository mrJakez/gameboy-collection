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

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const gameId = formData.get("gameId") as string;

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

    const pad = 0.008;
    const left = Math.max(0, bbox.x1 - pad);
    const top = Math.max(0, bbox.y1 - pad);
    const right = Math.min(1, bbox.x2 + pad);
    const bottom = Math.min(1, bbox.y2 + pad);

    const cropW = Math.max(1, Math.round((right - left) * imgW));
    const cropH = Math.max(1, Math.round((bottom - top) * imgH));

    const croppedBuffer = await sharp(jpegBuffer)
      .extract({
        left: Math.round(left * imgW),
        top: Math.round(top * imgH),
        width: cropW,
        height: cropH,
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    const dir = path.join(process.cwd(), "data", "cartridges");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `${gameId}_label_${Date.now()}.jpg`;
    fs.writeFileSync(path.join(dir, filename), croppedBuffer);

    // Clean up old label files for this game
    const old = fs.readdirSync(dir).filter(
      (f) => f.startsWith(`${gameId}_label_`) && f !== filename
    );
    for (const f of old) fs.unlinkSync(path.join(dir, f));

    return NextResponse.json({ path: `/images/cartridges/${filename}` });
  } catch (err) {
    console.error("process-cartridge error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
