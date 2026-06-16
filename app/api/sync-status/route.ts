import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "last-sync.json");

export async function GET() {
  if (!fs.existsSync(FILE)) return NextResponse.json({ syncedAt: null });
  try {
    const { syncedAt } = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return NextResponse.json({ syncedAt: syncedAt ?? null });
  } catch {
    return NextResponse.json({ syncedAt: null });
  }
}
