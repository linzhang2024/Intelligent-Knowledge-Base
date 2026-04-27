import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, USER_STATUS } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

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
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { message: "未登录，请先登录" },
          { status: 401 }
        );
      }
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { message: "无权限访问此资源" },
          { status: 403 }
        );
      }
      if (error.message === "账号待审核，请联系管理员" || 
          error.message === "账号已被禁用，请联系管理员") {
        return NextResponse.json(
          { message: error.message },
          { status: 403 }
        );
      }
    }
    console.error("获取用户列表失败:", error);
    return NextResponse.json(
      { message: "获取用户列表失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

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
      const currentUserId = request.cookies.get("kb_user_id")?.value;
      
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
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { message: "未登录，请先登录" },
          { status: 401 }
        );
      }
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { message: "无权限访问此资源" },
          { status: 403 }
        );
      }
      if (error.message === "账号待审核，请联系管理员" || 
          error.message === "账号已被禁用，请联系管理员") {
        return NextResponse.json(
          { message: error.message },
          { status: 403 }
        );
      }
    }
    console.error("批量操作用户失败:", error);
    return NextResponse.json(
      { message: "批量操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}
