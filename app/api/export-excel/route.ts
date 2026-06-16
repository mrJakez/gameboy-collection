import { NextResponse } from "next/server";
import { readGames } from "@/lib/db";
import * as XLSX from "xlsx";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export async function GET() {
  const games = readGames();

  const rows = games.map((g) => ({
    Title:     g.title,
    Platform:  g.platform,
    Status:    g.status,
    Year:      g.year || "",
    Rating:    g.rating ?? "",
    Spent:     g.purchasePrice ? parseFloat(g.purchasePrice) : "",
    Added:     formatDate(g.createdAt),
    "Play time (min)": g.playtime || "",
    Lent:      g.lent ? "Yes" : "No",
    Notes:     g.notes || "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 40 }, // Title
    { wch: 10 }, // Platform
    { wch: 12 }, // Status
    { wch: 6  }, // Year
    { wch: 8  }, // Rating
    { wch: 10 }, // Spent
    { wch: 12 }, // Added
    { wch: 16 }, // Play time
    { wch: 6  }, // Lent
    { wch: 40 }, // Notes
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Games");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="gameboy-collection-${date}.xlsx"`,
    },
  });
}
