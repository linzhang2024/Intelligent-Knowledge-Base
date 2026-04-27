import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export const USER_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  BANNED: "BANNED",
} as const;

export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];

export async function GET(request: NextRequest) {
  try {
    const currentUserId = getCurrentUserId(request);
    
    if (!currentUserId) {
      return NextResponse.json(
        { message: "未登录，请先登录" },
        { status: 401 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId, deletedAt: null },
      select: { role: true },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { message: "无权限访问此资源" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" as const },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return NextResponse.json(
      {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("获取用户列表失败:", error);
    return NextResponse.json(
      { message: "获取用户列表失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUserId = getCurrentUserId(request);
    
    if (!currentUserId) {
      return NextResponse.json(
        { message: "未登录，请先登录" },
        { status: 401 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId, deletedAt: null },
      select: { role: true },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { message: "无权限访问此资源" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, userIds } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { message: "用户ID列表不能为空" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      const result = await prisma.user.updateMany({
        where: {
          id: { in: userIds },
          status: USER_STATUS.PENDING,
          deletedAt: null,
        },
        data: {
          status: USER_STATUS.ACTIVE,
        },
      });

      return NextResponse.json(
        {
          message: `已审核通过 ${result.count} 个用户`,
          count: result.count,
        },
        { status: 200 }
      );
    }

    if (action === "ban") {
      const result = await prisma.user.updateMany({
        where: {
          id: { in: userIds },
          deletedAt: null,
        },
        data: {
          status: USER_STATUS.BANNED,
        },
      });

      return NextResponse.json(
        {
          message: `已禁用 ${result.count} 个用户`,
          count: result.count,
        },
        { status: 200 }
      );
    }

    if (action === "delete") {
      const result = await prisma.user.updateMany({
        where: {
          id: { in: userIds },
          deletedAt: null,
          id: { not: currentUserId },
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          message: `已删除 ${result.count} 个用户`,
          count: result.count,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: "无效的操作类型" },
      { status: 400 }
    );
  } catch (error) {
    console.error("批量操作用户失败:", error);
    return NextResponse.json(
      { message: "批量操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}
