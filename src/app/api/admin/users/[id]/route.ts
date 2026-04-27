import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, USER_STATUS } from "@/lib/auth";

const VALID_ROLES = ["ADMIN", "EDITOR", "VIEWER"];
const VALID_STATUSES = Object.values(USER_STATUS);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const userId = params.id;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!targetUser) {
      return NextResponse.json(
        { message: "用户不存在" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { role, status } = body;

    const updateData: { role?: string; status?: string } = {};

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json(
          { message: `无效的角色值，有效值为: ${VALID_ROLES.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.role = role;
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { message: `无效的状态值，有效值为: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { message: "未提供任何可更新的字段" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
    });

    return NextResponse.json(
      {
        message: "用户信息更新成功",
        user: updatedUser,
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
    console.error("更新用户失败:", error);
    return NextResponse.json(
      { message: "更新用户失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await requireAdmin(request);

    const userId = params.id;

    if (userId === currentUser.id) {
      return NextResponse.json(
        { message: "不能删除自己的账户" },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!targetUser) {
      return NextResponse.json(
        { message: "用户不存在" },
        { status: 404 }
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json(
      {
        message: "用户删除成功",
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
    console.error("删除用户失败:", error);
    return NextResponse.json(
      { message: "删除用户失败，请稍后重试" },
      { status: 500 }
    );
  }
}
