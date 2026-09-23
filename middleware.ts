import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, authSecret, expectedAuthToken, readSessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const gate = await expectedAuthToken();
  const secret = authSecret();

  // Nothing configured at all -> protection isn't set up, don't lock anyone out.
  if (!gate && !secret) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  // Two credentials open the dashboard, and either one is enough:
  //
  //   the shared-password gate   checked first because it is a plain string
  //                              comparison, and its token can never be mistaken
  //                              for a session token (different shape entirely)
  //   an account session         verified rather than compared: the token
  //                              carries a username, so its signature and age
  //                              have to be checked
  const admitted =
    Boolean(cookie && gate && cookie === gate) ||
    Boolean(cookie && (await readSessionToken(cookie)));

  // The login page belongs to people who are not in yet. Reached with a live
  // session it is a form that cannot mean anything — and, since it offers
  // "request an account", one that an admin could fill in and silently mint a
  // live account from. A signed-in visit goes on to the dashboard instead.
  if (req.nextUrl.pathname === "/login") {
    if (admitted) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (admitted) return NextResponse.next();

  // Asking for an account has to be possible before you have one, and the login
  // page is where a person finds out they need to ask — so this single request
  // is let through without a session. Only POST: the GET on the same path lists
  // the accounts, and that stays behind the gate.
  //
  // This is not the door; the route is. What it can produce without a session is
  // a PENDING request, which cannot sign in, and the two outcomes that grant
  // something (an admin's create, and the bootstrap that makes the first admin)
  // are re-checked inside app/api/users/route.ts. The gate stays the gate; this
  // only stops it from answering "request an account" with a login screen.
  if (req.method === "POST" && req.nextUrl.pathname === "/api/users") {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // `/login` is no longer excluded: it needs the middleware to send an already
  // signed-in visit onward, and to know that a signed-out one is allowed in.
  // `/api/login` stays out — a sign-in attempt arrives without a cookie by
  // definition, so gating it would mean the gate could never be passed.
  matcher: ["/((?!api/login|_next/static|_next/image|favicon.ico).*)"],
};
