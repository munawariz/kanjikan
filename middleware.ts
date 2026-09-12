import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const PUBLIC_PATHS = ["/", "/login", "/setup"];

/**
 * Whole sections a guest may use: lessons can be taken without an account,
 * just without anything being saved. These are the pages under app/(open).
 */
const GUEST_SECTIONS = ["/lessons"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    GUEST_SECTIONS.some((s) => pathname === s || pathname.startsWith(`${s}/`))
  );
}

const isDatabaseConfigured = Boolean(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL);

/**
 * Gates the app routes on whether a session cookie is present.
 *
 * Middleware cannot reach the database, so it cannot tell a live session from
 * an expired one; it only turns away requests that have no session at all.
 * The real check is getUser(), which every signed-in page and API route calls:
 * a stale cookie gets through here and is sent to /login there.
 *
 * That is also why a signed-in visitor to /login is not redirected here — with
 * a stale cookie that would bounce between /login and /dashboard forever. The
 * login page checks the session itself.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Without a database there is nothing to sign in to. Send everything to the
  // setup page rather than failing on each route.
  if (!isDatabaseConfigured) {
    if (pathname === "/setup") return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/setup";
    return NextResponse.redirect(url);
  }

  if (isPublicPath(pathname) || request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  // An API call must not be redirected to the sign-in page: fetch follows
  // the redirect, receives the login page's HTML with a 200, and the caller
  // reports a save that never happened. Answer with the 401 the routes give
  // themselves, which is what lets the study screen say the session expired.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // The icon, manifest, service worker and offline page must stay public. A
  // browser fetches all of them without credentials, so sending them through
  // the auth gate answers with a redirect to /login — which would leave the
  // installed app with no icon, no name, and a service worker that never
  // registers because /sw.js returned an HTML redirect instead of JavaScript.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
