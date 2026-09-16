import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isHttps = (forwardedProto || req.nextUrl.protocol.replace(":", "")) === "https";

  const res = NextResponse.json({ ok: true });
  // Mirrors the attributes used when the cookie was set — a Secure cookie and
  // a plain one with the same name can otherwise coexist and keep the session
  // alive after logging out.
  res.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
