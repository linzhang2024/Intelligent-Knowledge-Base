import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const AUTH_COOKIE_NAME = "kb_user_id";

export const USER_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  BANNED: "BANNED",
} as const;

export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: UserStatus;
}

export function getCurrentUserId(request?: NextRequest): string | null {
  let userId: string | undefined;
  
  if (request) {
    userId = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  } else {
    const cookieStore = cookies();
    userId = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  }
  
  return userId || null;
}

export async function getCurrentUser(request?: NextRequest): Promise<AuthUser | null> {
  const userId = getCurrentUserId(request);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { 
      id: userId,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status as UserStatus,
  };
}

export async function requireAuth(request?: NextRequest): Promise<AuthUser> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error("未授权访问");
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    if (user.status === USER_STATUS.PENDING) {
      throw new Error("账号待审核，请联系管理员");
    }
    if (user.status === USER_STATUS.BANNED) {
      throw new Error("账号已被禁用，请联系管理员");
    }
    throw new Error("账号状态异常");
  }
  return user;
}

export async function requireAdmin(request?: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (user.role !== "ADMIN") {
    throw new Error("无权限访问此资源");
  }
  return user;
}
