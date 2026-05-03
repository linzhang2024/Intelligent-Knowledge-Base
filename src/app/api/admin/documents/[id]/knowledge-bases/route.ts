import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

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
        knowledgeBaseLinks: {
          include: {
            knowledgeBase: {
              select: {
                id: true,
                name: true,
              },
            },
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

    if (!document) {
      return NextResponse.json(
        { message: "文档不存在" },
        { status: 404 }
      );
    }

    const knowledgeBases = [
      ...(document.knowledgeBase ? [document.knowledgeBase] : []),
      ...document.knowledgeBaseLinks.map((link) => link.knowledgeBase),
    ];

    const uniqueKnowledgeBases = knowledgeBases.filter(
      (kb, index, self) =>
        index === self.findIndex((t) => t.id === kb.id)
    );

    return NextResponse.json(
      {
        documentId,
        knowledgeBases: uniqueKnowledgeBases,
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
    console.error("获取文档关联知识库失败:", error);
    return NextResponse.json(
      { message: "获取文档关联知识库失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const documentId = params.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId, deletedAt: null },
    });

    if (!document) {
      return NextResponse.json(
        { message: "文档不存在" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { knowledgeBaseId, knowledgeBaseIds } = body;

    const idsToAdd: string[] = [];

    if (knowledgeBaseId) {
      idsToAdd.push(knowledgeBaseId);
    }

    if (knowledgeBaseIds && Array.isArray(knowledgeBaseIds)) {
      idsToAdd.push(...knowledgeBaseIds);
    }

    if (idsToAdd.length === 0) {
      return NextResponse.json(
        { message: "请提供知识库ID" },
        { status: 400 }
      );
    }

    const existingKnowledgeBases = await prisma.knowledgeBase.findMany({
      where: { id: { in: idsToAdd } },
      select: { id: true },
    });

    const existingIds = existingKnowledgeBases.map((kb) => kb.id);
    const invalidIds = idsToAdd.filter((id) => !existingIds.includes(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { message: `知识库不存在: ${invalidIds.join(", ")}` },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const kbId of existingIds) {
        try {
          await tx.knowledgeBaseDocument.create({
            data: {
              documentId,
              knowledgeBaseId: kbId,
            },
          });
        } catch (e) {
          console.log(`文档 ${documentId} 已关联知识库 ${kbId}，跳过`);
        }
      }
    });

    const updatedDocument = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        knowledgeBaseLinks: {
          include: {
            knowledgeBase: {
              select: {
                id: true,
                name: true,
              },
            },
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

    const knowledgeBases = [
      ...(updatedDocument?.knowledgeBase ? [updatedDocument.knowledgeBase] : []),
      ...(updatedDocument?.knowledgeBaseLinks.map((link) => link.knowledgeBase) || []),
    ];

    const uniqueKnowledgeBases = knowledgeBases.filter(
      (kb, index, self) =>
        index === self.findIndex((t) => t.id === kb.id)
    );

    return NextResponse.json(
      {
        message: "文档已成功添加到知识库",
        documentId,
        knowledgeBases: uniqueKnowledgeBases,
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
    console.error("添加文档到知识库失败:", error);
    return NextResponse.json(
      { message: "添加文档到知识库失败，请稍后重试" },
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

    const document = await prisma.document.findUnique({
      where: { id: documentId, deletedAt: null },
    });

    if (!document) {
      return NextResponse.json(
        { message: "文档不存在" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { knowledgeBaseId, knowledgeBaseIds } = body;

    const idsToRemove: string[] = [];

    if (knowledgeBaseId) {
      idsToRemove.push(knowledgeBaseId);
    }

    if (knowledgeBaseIds && Array.isArray(knowledgeBaseIds)) {
      idsToRemove.push(...knowledgeBaseIds);
    }

    if (idsToRemove.length === 0) {
      return NextResponse.json(
        { message: "请提供要移除的知识库ID" },
        { status: 400 }
      );
    }

    await prisma.knowledgeBaseDocument.deleteMany({
      where: {
        documentId,
        knowledgeBaseId: { in: idsToRemove },
      },
    });

    const updatedDocument = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        knowledgeBaseLinks: {
          include: {
            knowledgeBase: {
              select: {
                id: true,
                name: true,
              },
            },
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

    const knowledgeBases = [
      ...(updatedDocument?.knowledgeBase ? [updatedDocument.knowledgeBase] : []),
      ...(updatedDocument?.knowledgeBaseLinks.map((link) => link.knowledgeBase) || []),
    ];

    const uniqueKnowledgeBases = knowledgeBases.filter(
      (kb, index, self) =>
        index === self.findIndex((t) => t.id === kb.id)
    );

    return NextResponse.json(
      {
        message: "文档已成功从知识库移除",
        documentId,
        knowledgeBases: uniqueKnowledgeBases,
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
    console.error("从知识库移除文档失败:", error);
    return NextResponse.json(
      { message: "从知识库移除文档失败，请稍后重试" },
      { status: 500 }
    );
  }
}
