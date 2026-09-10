import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/", "/login", "/setup"];

/**
 * Refreshes the Supabase session cookie on every request and gates the app
 * routes. Server Components cannot write cookies, so without this the access
 * token would silently expire and every page would bounce to login.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // Without credentials there is no session to refresh. Send everything to the
  // setup page rather than crashing on each route.
  if (!isSupabaseConfigured) {
    if (pathname === "/setup") return response;
    const url = request.nextUrl.clone();
    url.pathname = "/setup";
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // The icon, manifest, service worker and offline page must stay public. A
  // browser fetches all of them without credentials, so sending them through
  // the auth gate answers with a redirect to /login — which would leave the
  // installed app with no icon, no name, and a service worker that never
  // registers because /sw.js returned an HTML redirect instead of JavaScript.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|manifest.webmanifest|sw.js|offline.html|icons/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
