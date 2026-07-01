import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { method, nextUrl } = req;
  const path = nextUrl.pathname;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  // Structured access log — picked up by Docker / Loki
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level: "info",
    type: "access",
    method,
    path,
    ip,
    ua: req.headers.get("user-agent") ?? undefined,
  });
  console.log(entry);

  return NextResponse.next();
}

export const config = {
  matcher: [
    // All routes except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
