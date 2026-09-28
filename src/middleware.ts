import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login"];

function sessionRole(value?: string) {
  if (value === "waiter") return "waiter";
  if (value === "admin" || value === "admin-logged-in") return "admin";
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isApi = pathname.startsWith("/api");
  const isStatic =
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico";

  if (isApi || isStatic) {
    return NextResponse.next();
  }

  const role = sessionRole(request.cookies.get("restaurant_session")?.value);

  if (!role && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (role && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (role === "waiter" && pathname.startsWith("/history")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
