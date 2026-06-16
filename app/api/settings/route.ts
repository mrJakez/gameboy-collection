import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/api/auth/route";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "settings.json");

interface Settings {
  syncReminderDays: number | null; // null = disabled, default 30
}

function readSettings(): Settings {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch { /* ignore */ }
  return { syncReminderDays: 30 };
}

export async function GET() {
  return NextResponse.json(readSettings());
}

export async function PATCH(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const current = readSettings();
  if ("syncReminderDays" in body) {
    const val = body.syncReminderDays;
    if (val !== null && (typeof val !== "number" || val < 1)) {
      return NextResponse.json({ error: "Invalid value" }, { status: 400 });
    }
    current.syncReminderDays = val;
  }
  fs.writeFileSync(FILE, JSON.stringify(current, null, 2));
  return NextResponse.json(current);
}
