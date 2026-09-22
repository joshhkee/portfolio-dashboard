import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, authSecret, expectedAuthToken, readSessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const gate = await expectedAuthToken();
  const secret = authSecret();

  // Nothing configured at all -> protection isn't set up, don't lock anyone out.
  if (!gate && !secret) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  // The shared-password gate, still valid on its own. Checked first because it
  // is a plain string comparison, and because its token can never be mistaken
  // for a session token (different shape entirely).
  if (cookie && gate && cookie === gate) return NextResponse.next();

  // An account session. Verified rather than compared: the token carries a
  // username, so it has to be checked for a valid signature and a live age.
  if (cookie && (await readSessionToken(cookie))) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico).*)"],
};
