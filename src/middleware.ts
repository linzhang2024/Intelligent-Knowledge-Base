import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export const USER_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  BANNED: "BANNED",
} as const;

export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];

const PROTECTED_PATHS = [
  "/dashboard",
  "/admin",
  "/api/admin",
  "/api/documents/upload",
  "/api/kb",
];

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/",
  "/api/uploads",
  "/_next",
  "/favicon.ico",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isProtectedPath = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  const userId = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!userId && isProtectedPath) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { message: "未登录，请先登录" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (userId && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/api/admin/:path*",
    "/api/documents/:path*",
    "/api/kb/:path*",
    "/api/auth/login",
    "/api/auth/register",
  ],
};
