import { NextRequest } from "next/server";
import { isAuthenticated } from "@/app/api/auth/route";
import { readMeta } from "@/app/api/screenshots/route";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const SCREENSHOTS_DIR = path.join(process.cwd(), "data", "screenshots");
const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".bmp", ".gif"]);

// ── Perceptual hash (average hash, 8×8) ───────────────────────────

async function ahash(filepath: string): Promise<number[] | null> {
  try {
    const { data } = await sharp(filepath, { failOn: "error" })
      .resize(8, 8, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = Array.from(data as Uint8Array);
    const avg = pixels.reduce((s, v) => s + v, 0) / pixels.length;
    return pixels.map(p => (p >= avg ? 1 : 0));
  } catch {
    return null;
  }
}

function hammingDistance(a: number[], b: number[]): number {
  let dist = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) dist++;
  return dist;
}

export interface DuplicateGroup {
  files: string[];
  method: "exact" | "perceptual";
  similarity?: number;
}

// ── SSE streaming route ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const meta = readMeta();
  const files = fs.existsSync(SCREENSHOTS_DIR)
    ? fs.readdirSync(SCREENSHOTS_DIR)
        .filter(f => ALLOWED_EXT.has(path.extname(f).toLowerCase()) && !meta[f]?.deleted)
        .sort()
    : [];

  const total = files.length;

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: object) {
        controller.enqueue(`data: ${JSON.stringify(obj)}\n\n`);
      }

      if (total < 2) {
        send({ done: true, groups: [], total });
        controller.close();
        return;
      }

      // Compute hashes sequentially, emitting progress per file
      const hashes: { f: string; hash: number[] }[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        send({ progress: i + 1, total, current: f });
        const hash = await ahash(path.join(SCREENSHOTS_DIR, f));
        if (hash) hashes.push({ f, hash });
      }

      // Find duplicate groups
      const groups: DuplicateGroup[] = [];
      const checked = new Set<string>();

      for (let i = 0; i < hashes.length; i++) {
        if (checked.has(hashes[i].f)) continue;
        const group: string[] = [hashes[i].f];
        for (let j = i + 1; j < hashes.length; j++) {
          if (checked.has(hashes[j].f)) continue;
          if (hammingDistance(hashes[i].hash, hashes[j].hash) <= 4) {
            group.push(hashes[j].f);
          }
        }
        if (group.length > 1) {
          group.forEach(f => checked.add(f));
          const isExact = group.every(f =>
            hammingDistance(hashes.find(h => h.f === f)!.hash, hashes[i].hash) === 0
          );
          groups.push({ files: group, method: isExact ? "exact" : "perceptual" });
        }
      }

      send({ done: true, groups, total });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
