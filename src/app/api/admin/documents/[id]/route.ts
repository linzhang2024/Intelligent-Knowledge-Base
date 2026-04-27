import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export const DOCUMENT_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export type DocumentStatus = typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS];

const VALID_STATUSES = Object.values(DOCUMENT_STATUS);

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
      where: { id: currentUserId, deletedAt: null },
      select: { role: true },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { message: "无权限访问此资源" },
        { status: 403 }
      );
    }

    const documentId = params.id;

    const targetDocument = await prisma.document.findUnique({
      where: { id: documentId, deletedAt: null },
    });

    if (!targetDocument) {
      return NextResponse.json(
        { message: "文档不存在" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status, title, content } = body;

    const updateData: Record<string, unknown> = {};

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { message: `无效的状态值，有效值为: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    if (title !== undefined) {
      updateData.title = title;
    }

    if (content !== undefined) {
      updateData.content = content;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { message: "未提供任何可更新的字段" },
        { status: 400 }
      );
    }

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        knowledgeBase: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const serializedDocument = {
      ...updatedDocument,
      fileSize: updatedDocument.fileSize?.toString() || null,
    };

    return NextResponse.json(
      {
        message: "文档更新成功",
        document: serializedDocument,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("更新文档失败:", error);
    return NextResponse.json(
      { message: "更新文档失败，请稍后重试" },
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
      where: { id: currentUserId, deletedAt: null },
      select: { role: true },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { message: "无权限访问此资源" },
        { status: 403 }
      );
    }

    const documentId = params.id;

    const targetDocument = await prisma.document.findUnique({
      where: { id: documentId, deletedAt: null },
    });

    if (!targetDocument) {
      return NextResponse.json(
        { message: "文档不存在" },
        { status: 404 }
      );
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json(
      {
        message: "文档删除成功",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("删除文档失败:", error);
    return NextResponse.json(
      { message: "删除文档失败，请稍后重试" },
      { status: 500 }
    );
  }
}
