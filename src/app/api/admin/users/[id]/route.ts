import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

const VALID_ROLES = ["ADMIN", "EDITOR", "VIEWER"];
const VALID_STATUSES = ["ACTIVE", "INACTIVE", "BANNED"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = getCurrentUserId(request);
    
    if (!currentUserId) {
      return NextResponse.json(
        { message: "未登录，请先登录" },
        { status: 401 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { message: "无权限访问此资源" },
        { status: 403 }
      );
    }

    const userId = params.id;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
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
    const currentUserId = getCurrentUserId(request);
    
    if (!currentUserId) {
      return NextResponse.json(
        { message: "未登录，请先登录" },
        { status: 401 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { message: "无权限访问此资源" },
        { status: 403 }
      );
    }

    const userId = params.id;

    if (userId === currentUserId) {
      return NextResponse.json(
        { message: "不能删除自己的账户" },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { message: "用户不存在" },
        { status: 404 }
      );
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json(
      {
        message: "用户删除成功",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("删除用户失败:", error);
    return NextResponse.json(
      { message: "删除用户失败，请稍后重试" },
      { status: 500 }
    );
  }
}
