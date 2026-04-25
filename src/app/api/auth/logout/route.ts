import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { message: "登出成功" },
    { status: 200 }
  );

  response.cookies.delete(AUTH_COOKIE_NAME);

  return response;
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: "请使用 POST 方法登出" },
    { status: 405 }
  );
}
