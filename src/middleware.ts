import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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
  "/api/auth/login",
  "/api/auth/logout",
  "/",
  "/api/uploads",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isProtectedPath = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  const userId = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { status: true, deletedAt: true },
      });

      if (!user || user.deletedAt) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete(AUTH_COOKIE_NAME);
        return response;
      }

      if (user.status !== USER_STATUS.ACTIVE) {
        if (pathname === "/login" || pathname === "/api/auth/login") {
          return NextResponse.next();
        }

        if (pathname.startsWith("/api")) {
          let message = "账号待审核，请联系管理员";
          if (user.status === USER_STATUS.BANNED) {
            message = "账号已被禁用，请联系管理员";
          }
          return NextResponse.json(
            { message },
            { status: 403 }
          );
        }

        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete(AUTH_COOKIE_NAME);
        return response;
      }
    } catch (error) {
      console.error("Middleware 验证用户状态失败:", error);
    }
  }

  if (!userId && isProtectedPath) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { message: "未登录，请先登录" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (userId && pathname === "/login") {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { status: true, deletedAt: true, role: true },
      });

      if (user && !user.deletedAt && user.status === USER_STATUS.ACTIVE) {
        const redirectPath = user.role === "ADMIN" ? "/admin" : "/dashboard";
        return NextResponse.redirect(new URL(redirectPath, request.url));
      }
    } catch (error) {
      console.error("Middleware 重定向已登录用户失败:", error);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
    "/api/admin/:path*",
    "/api/documents/:path*",
    "/api/kb/:path*",
    "/api/auth/login",
  ],
};
