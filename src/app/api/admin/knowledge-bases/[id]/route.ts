import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const knowledgeBaseId = params.id;

    const knowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { documents: true },
        },
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { message: "知识库不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        knowledgeBase: {
          ...knowledgeBase,
          documentCount: knowledgeBase._count.documents,
          _count: undefined,
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
    console.error("获取知识库详情失败:", error);
    return NextResponse.json(
      { message: "获取知识库详情失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const knowledgeBaseId = params.id;

    const targetKnowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
    });

    if (!targetKnowledgeBase) {
      return NextResponse.json(
        { message: "知识库不存在" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, ownerId, visibility } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined && name !== "") {
      updateData.name = name;
    }

    if (description !== undefined) {
      updateData.description = description || null;
    }

    if (ownerId !== undefined && ownerId !== "") {
      updateData.ownerId = ownerId;
    }

    if (visibility !== undefined) {
      const validVisibilities = ["PRIVATE", "PUBLIC"];
      if (!validVisibilities.includes(visibility)) {
        return NextResponse.json(
          { message: `无效的可见范围值，有效值为: ${validVisibilities.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.visibility = visibility;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { message: "未提供任何可更新的字段" },
        { status: 400 }
      );
    }

    const updatedKnowledgeBase = await prisma.knowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { documents: true },
        },
      },
    });

    return NextResponse.json(
      {
        message: "知识库更新成功",
        knowledgeBase: {
          ...updatedKnowledgeBase,
          documentCount: updatedKnowledgeBase._count.documents,
          _count: undefined,
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
    console.error("更新知识库失败:", error);
    return NextResponse.json(
      { message: "更新知识库失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const knowledgeBaseId = params.id;

    const targetKnowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });

    if (!targetKnowledgeBase) {
      return NextResponse.json(
        { message: "知识库不存在" },
        { status: 404 }
      );
    }

    if (targetKnowledgeBase._count.documents > 0) {
      return NextResponse.json(
        { message: "该知识库下还有文档，无法删除，请先转移或删除文档" },
        { status: 400 }
      );
    }

    await prisma.knowledgeBase.delete({
      where: { id: knowledgeBaseId },
    });

    return NextResponse.json(
      {
        message: "知识库删除成功",
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
    console.error("删除知识库失败:", error);
    return NextResponse.json(
      { message: "删除知识库失败，请稍后重试" },
      { status: 500 }
    );
  }
}
