import { NextRequest } from "next/server";
import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "kb_user_id";

export interface AuthUser {
  id: string;
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

export function getCurrentUser(request?: NextRequest): AuthUser | null {
  const userId = getCurrentUserId(request);
  if (!userId) return null;
  return { id: userId };
}

export function requireAuth(request?: NextRequest): AuthUser {
  const user = getCurrentUser(request);
  if (!user) {
    throw new Error("未授权访问");
  }
  return user;
}
