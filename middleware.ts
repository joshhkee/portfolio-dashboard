import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, expectedAuthToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const expected = await expectedAuthToken();
  // No SITE_PASSWORD configured -> protection isn't set up, don't lock
  // anyone out.
  if (!expected) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookie === expected) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // api/logout has to stay reachable while signed out, otherwise the gate
  // bounces the request that clears the cookie.
  matcher: ["/((?!login|api/login|api/logout|_next/static|_next/image|favicon.ico).*)"],
};
