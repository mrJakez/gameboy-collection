import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "last-sync.json");
const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");
const SCREENSHOTS_DIR = path.join(process.cwd(), "data", "screenshots");

function parseScreenshotTimestamp(filename: string): Date | null {
  const m = filename.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
}

function latestScreenshotDate(): string | null {
  try {
    if (!fs.existsSync(SCREENSHOTS_DIR)) return null;
    const files = fs.readdirSync(SCREENSHOTS_DIR);
    let latest: Date | null = null;
    let latestFile: string | null = null;
    for (const f of files) {
      const d = parseScreenshotTimestamp(f);
      if (d && (!latest || d > latest)) { latest = d; latestFile = f; }
    }
    return latestFile ?? null;
  } catch { return null; }
}

export async function GET() {
  let syncedAt: string | null = null;
  try {
    if (fs.existsSync(FILE)) {
      syncedAt = JSON.parse(fs.readFileSync(FILE, "utf-8")).syncedAt ?? null;
    }
  } catch { /* ignore */ }

  let syncReminderDays: number | null = 30;
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const s = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      syncReminderDays = s.syncReminderDays ?? 30;
    }
  } catch { /* ignore */ }

  const latestScreenshot = latestScreenshotDate();
  let latestScreenshotAt: string | null = null;
  if (latestScreenshot) {
    const d = parseScreenshotTimestamp(latestScreenshot);
    if (d) latestScreenshotAt = d.toISOString();
  }

  const isOverdueFor = (ts: string | null) =>
    syncReminderDays !== null &&
    (ts === null || Date.now() - new Date(ts).getTime() > syncReminderDays * 86_400_000);

  const binOverdue = isOverdueFor(syncedAt);
  const screenshotOverdue = latestScreenshot !== null && isOverdueFor(latestScreenshotAt);
  const overdue = binOverdue || screenshotOverdue;

  return NextResponse.json({ syncedAt, syncReminderDays, overdue, binOverdue, screenshotOverdue, latestScreenshot, latestScreenshotAt });
}
