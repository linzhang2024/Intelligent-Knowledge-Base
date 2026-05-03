import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const USER_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  BANNED: "BANNED",
} as const;

const USER_ROLE = {
  ADMIN: "ADMIN",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { message: "邮箱和密码不能为空" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "密码长度至少为6位" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "该邮箱已被注册" },
        { status: 400 }
      );
    }

    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    const newUser = await prisma.user.create({
      data: {
        email,
        password,
        name: name || email.split("@")[0],
        role: isFirstUser ? USER_ROLE.ADMIN : USER_ROLE.VIEWER,
        status: isFirstUser ? USER_STATUS.ACTIVE : USER_STATUS.PENDING,
      },
    });

    if (isFirstUser) {
      console.log("========================================");
      console.log("  初始管理员账号已创建:");
      console.log("  邮箱: admin@example.com");
      console.log("  密码: admin123");
      console.log("========================================");
    }

    await prisma.knowledgeBase.create({
      data: {
        name: "我的第一个知识库",
        description: "自动创建的默认知识库",
        ownerId: newUser.id,
      },
    });

    if (isFirstUser) {
      return NextResponse.json(
        {
          message: "初始管理员账号创建成功，请使用该账号登录",
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            status: newUser.status,
          },
          isFirstUser: true,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        message: "注册申请已提交，请等待管理员审核",
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          status: newUser.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("注册失败:", error);
    return NextResponse.json(
      { message: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: "请使用 POST 方法注册" },
    { status: 405 }
  );
}
