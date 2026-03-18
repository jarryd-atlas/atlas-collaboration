import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/callback", "/pending", "/welcome"];
const REPORT_ROUTE_PREFIX = "/r/";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // ─── SEO Protection: noindex on ALL routes ───
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  // ─── Auth check for (app) routes ───
  const isPublicRoute =
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith(REPORT_ROUTE_PREFIX) ||
    pathname === "/robots.txt" ||
    pathname === "/favicon.ico";

  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.headers.set("X-Robots-Tag", "noindex, nofollow");
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session (important for token rotation)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isPublicRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated user is on login page, redirect to app
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Check profile status from JWT claims for authenticated non-public routes
  if (user && !isPublicRoute) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      try {
        const claims = JSON.parse(atob(session.access_token.split(".")[1]!));
        const profileStatus = claims.profile_status;

        if (profileStatus === "pending_approval" || profileStatus === "pending") {
          if (pathname !== "/pending") {
            return NextResponse.redirect(new URL("/pending", request.url));
          }
        }
        if (profileStatus === "disabled") {
          // Sign out disabled users
          await supabase.auth.signOut();
          return NextResponse.redirect(new URL("/login", request.url));
        }
      } catch {
        // JWT decode failed — allow through, session might be refreshing
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
