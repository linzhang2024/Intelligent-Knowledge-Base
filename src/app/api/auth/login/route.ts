import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { message: "邮箱和密码不能为空" },
        { status: 400 }
      );
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    const isAdminEmail = email.toLowerCase().includes("admin");

    if (!user) {
      const userCount = await prisma.user.count();
      const isFirstUser = userCount === 0;

      user = await prisma.user.create({
        data: {
          email,
          password,
          name: email.split("@")[0],
          role: isFirstUser || isAdminEmail ? "ADMIN" : "VIEWER",
        },
      });

      await prisma.knowledgeBase.create({
        data: {
          name: "我的第一个知识库",
          description: "自动创建的默认知识库",
          ownerId: user.id,
        },
      });
    } else if (isAdminEmail && user.role !== "ADMIN") {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: "ADMIN" },
      });
    }

    if (user.password !== password) {
      return NextResponse.json(
        { message: "邮箱或密码错误" },
        { status: 401 }
      );
    }

    const response = NextResponse.json(
      {
        message: "登录成功",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 200 }
    );

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: user.id,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("登录失败:", error);
    return NextResponse.json(
      { message: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: "请使用 POST 方法登录" },
    { status: 405 }
  );
}
