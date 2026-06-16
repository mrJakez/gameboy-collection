import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "last-sync.json");
const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

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

  const overdue =
    syncReminderDays !== null &&
    (syncedAt === null ||
      Date.now() - new Date(syncedAt).getTime() > syncReminderDays * 86_400_000);

  return NextResponse.json({ syncedAt, syncReminderDays, overdue });
}
