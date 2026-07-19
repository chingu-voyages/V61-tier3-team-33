import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isLoggedIn = request.cookies.get("session")?.value === "true";
  const isGuest = request.cookies.get("guest")?.value === "true";
  const isAuthorized = isLoggedIn || isGuest;

  const isPublic = publicRoutes.includes(path);

  if (!isPublic && !isAuthorized) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublic && isAuthorized) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
