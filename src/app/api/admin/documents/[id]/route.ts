import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const DOCUMENT_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

type DocumentStatus = typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS];

const VALID_STATUSES = Object.values(DOCUMENT_STATUS);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const documentId = params.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId, deletedAt: null },
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
        chunks: {
          orderBy: { index: "asc" as const },
          select: {
            id: true,
            index: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { message: "文档不存在" },
        { status: 404 }
      );
    }

    const serializedDocument = {
      ...document,
      fileSize: document.fileSize?.toString() || null,
      chunks: document.chunks.map(chunk => ({
        ...chunk,
      })),
    };

    return NextResponse.json(
      {
        document: serializedDocument,
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
    console.error("获取文档详情失败:", error);
    return NextResponse.json(
      { message: "获取文档详情失败，请稍后重试" },
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
    const { status, title, content, knowledgeBaseId } = body;

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

    if (knowledgeBaseId !== undefined) {
      if (knowledgeBaseId === null || knowledgeBaseId === "") {
        updateData.knowledgeBaseId = null;
      } else {
        const knowledgeBase = await prisma.knowledgeBase.findUnique({
          where: { id: knowledgeBaseId },
        });
        if (!knowledgeBase) {
          return NextResponse.json(
            { message: "指定的知识库不存在" },
            { status: 400 }
          );
        }
        updateData.knowledgeBaseId = knowledgeBaseId;
      }
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
    await requireAdmin(request);

    const documentId = params.id;

    const targetDocument = await prisma.document.findUnique({
      where: { id: documentId, deletedAt: null },
      include: {
        chunks: true,
      },
    });

    if (!targetDocument) {
      return NextResponse.json(
        { message: "文档不存在" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const chunkCount = targetDocument.chunks.length;
      if (chunkCount > 0) {
        await tx.documentChunk.deleteMany({
          where: { documentId },
        });
        console.log(`[文档删除] 已删除文档 "${targetDocument.title}" 的 ${chunkCount} 个关联切片`);
      }

      await tx.document.update({
        where: { id: documentId },
        data: { deletedAt: new Date() },
      });
    });

    return NextResponse.json(
      {
        message: "文档删除成功",
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
    console.error("删除文档失败:", error);
    return NextResponse.json(
      { message: "删除文档失败，请稍后重试" },
      { status: 500 }
    );
  }
}
