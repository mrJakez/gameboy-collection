import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/api/auth/route";
import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { readGames } from "@/lib/db";
import type { Game } from "@/lib/games";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const listBin = formData.get("list") as File | null;
  const playtimesBin = formData.get("playtimes") as File | null;

  if (!listBin || !playtimesBin) {
    return NextResponse.json({ error: "Both files (list.bin and playtimes.bin) are required." }, { status: 400 });
  }

  if (!listBin.name.endsWith(".bin") || !playtimesBin.name.endsWith(".bin")) {
    return NextResponse.json({ error: "Only .bin files are allowed." }, { status: 400 });
  }

  const playedDir = path.join(process.cwd(), "data", "analogue-pocket-playedgames");
  const libraryDir = "/analogue-pocket-library";
  const scriptPath = path.join(process.cwd(), "scripts", "import_pocket.py");

  fs.mkdirSync(playedDir, { recursive: true });
  fs.writeFileSync(path.join(playedDir, "list.bin"), Buffer.from(await listBin.arrayBuffer()));
  fs.writeFileSync(path.join(playedDir, "playtimes.bin"), Buffer.from(await playtimesBin.arrayBuffer()));

  const beforeMap = new Map<string, Game>(readGames().map((g) => [g.id, g]));

  try {
    const python = process.env.PYTHON_BIN ?? "python3";
    const { stdout, stderr } = await execFileAsync(python, [
      scriptPath,
      "--played-dir", playedDir,
      "--library-dir", libraryDir,
    ], { timeout: 120_000 });

    const afterGames = readGames();
    const changes: { title: string; type: "added" | "playtime" | "status"; before?: string; after?: string }[] = [];

    for (const game of afterGames) {
      const before = beforeMap.get(game.id);
      if (!before) {
        changes.push({ title: game.title, type: "added" });
      } else {
        if (game.playtime !== before.playtime) {
          changes.push({ title: game.title, type: "playtime", before: String(before.playtime), after: String(game.playtime) });
        }
        if (game.status !== before.status) {
          changes.push({ title: game.title, type: "status", before: before.status, after: game.status });
        }
      }
    }

    const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");
    fs.writeFileSync(
      path.join(process.cwd(), "data", "last-sync.json"),
      JSON.stringify({ syncedAt: new Date().toISOString() })
    );
    return NextResponse.json({ ok: true, output, changes });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = (e.stdout ?? "") + "\n" + (e.stderr ?? "");
    return NextResponse.json({ error: e.message ?? "Script failed", output }, { status: 500 });
  }
}
