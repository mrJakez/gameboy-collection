export function parseScreenshotDate(filename: string): Date | null {
  const m = filename.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
}

export function formatScreenshotDate(filename: string): string | null {
  const d = parseScreenshotDate(filename);
  if (!d) return null;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatScreenshotDateTime(filename: string): { date: string; time: string } | null {
  const d = parseScreenshotDate(filename);
  if (!d) return null;
  return {
    date: d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }),
    time: d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
  };
}
