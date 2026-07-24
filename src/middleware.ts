import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  const isAdminPath = pathname.startsWith("/admin");
  const isCustomerApp = pathname.startsWith("/orders");

  if (pathname === "/admin/login" || pathname === "/login" || pathname === "/register") {
    return NextResponse.next();
  }

  if (isAdminPath) {
    if (!user || user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  if (isCustomerApp) {
    if (!user || user.role !== "CUSTOMER") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/orders/:path*", "/orders"],
};
