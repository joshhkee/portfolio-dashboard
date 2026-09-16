import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE,
  configuredPasswords,
  expectedAuthToken,
  normalizePassword,
  passwordMatches,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const configured = configuredPasswords();

  if (configured.length === 0) {
    return NextResponse.json(
      { error: "SITE_PASSWORD isn't configured on the server" },
      { status: 500 }
    );
  }
  if (typeof password !== "string" || !passwordMatches(password, configured)) {
    // Letter case is the one near-miss worth naming — it tells you the value
    // itself is right without revealing anything you didn't already type.
    const attempted = typeof password === "string" ? normalizePassword(password) : "";
    const caseOnly =
      attempted.length > 0 &&
      configured.some((candidate) => candidate.toLowerCase() === attempted.toLowerCase());
    return NextResponse.json(
      {
        error: caseOnly
          ? "Almost — that password is right except for letter case, which is significant here."
          : "Incorrect password",
      },
      { status: 401 }
    );
  }

  const token = await expectedAuthToken();
  // The preview is served over HTTPS through a proxy and is often embedded in
  // a frame on another origin, where a SameSite=Lax cookie is treated as
  // third-party and silently dropped. None+Secure is the pair that survives
  // that; plain HTTP (local `next dev`) can't use None, so it keeps Lax.
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isHttps = (forwardedProto || req.nextUrl.protocol.replace(":", "")) === "https";

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, token!, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
