import { NextResponse } from "next/server";
import { readDeleted } from "@/lib/db";

export async function GET() {
  return NextResponse.json(readDeleted());
}
