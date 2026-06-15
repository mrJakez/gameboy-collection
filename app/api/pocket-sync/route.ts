import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/api/auth/route";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const PLAYED_DIR = path.join(process.cwd(), "pocket-played");

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const listBin = formData.get("list") as File | null;
  const playtimesBin = formData.get("playtimes") as File | null;

  if (!listBin || !playtimesBin) {
    return NextResponse.json({ error: "Beide Dateien (list.bin und playtimes.bin) werden benötigt." }, { status: 400 });
  }

  if (!listBin.name.endsWith(".bin") || !playtimesBin.name.endsWith(".bin")) {
    return NextResponse.json({ error: "Nur .bin-Dateien erlaubt." }, { status: 400 });
  }

  fs.mkdirSync(PLAYED_DIR, { recursive: true });

  fs.writeFileSync(path.join(PLAYED_DIR, "list.bin"), Buffer.from(await listBin.arrayBuffer()));
  fs.writeFileSync(path.join(PLAYED_DIR, "playtimes.bin"), Buffer.from(await playtimesBin.arrayBuffer()));

  const scriptPath = path.join(process.cwd(), "scripts", "import_pocket.py");
  const libraryDir = path.join(process.cwd(), "pocket-library");

  try {
    const python = process.env.PYTHON_BIN ?? "python3";
    const { stdout, stderr } = await execFileAsync(python, [
      scriptPath,
      "--played-dir", PLAYED_DIR,
      "--library-dir", libraryDir,
    ], { timeout: 120_000 });

    const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");
    return NextResponse.json({ ok: true, output });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = (e.stdout ?? "") + "\n" + (e.stderr ?? "");
    return NextResponse.json({ error: e.message ?? "Script failed", output }, { status: 500 });
  }
}
