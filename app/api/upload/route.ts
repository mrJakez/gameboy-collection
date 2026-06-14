import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isAuthenticated } from "@/app/api/auth/route";

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const gameId = formData.get("gameId") as string;

  if (!file || !gameId) {
    return NextResponse.json({ error: "Missing file or gameId" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${gameId}.${ext}`;
  const uploadsDir = path.join(process.cwd(), "data", "cartridges");

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const bytes = await file.arrayBuffer();
  fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(bytes));

  return NextResponse.json({ path: `/images/cartridges/${filename}` });
}
