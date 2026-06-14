import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE = "admin_session";

function isCorrectPassword(pw: string) {
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw) return false;
  return pw === adminPw;
}

export function isAuthenticated(req: NextRequest): boolean {
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw) return true; // no password set → open
  const cookie = req.cookies.get(COOKIE);
  return cookie?.value === adminPw;
}

export async function GET() {
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw) return NextResponse.json({ authenticated: true });
  const store = await cookies();
  const cookie = store.get(COOKIE);
  return NextResponse.json({ authenticated: cookie?.value === adminPw });
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!isCorrectPassword(password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, process.env.ADMIN_PASSWORD!, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
