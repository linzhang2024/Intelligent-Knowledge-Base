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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
      OR: [
        { knowledgeBaseId },
        {
          knowledgeBaseLinks: {
            some: {
              knowledgeBaseId,
            },
          },
        },
      ],
    };

    if (search) {
      (where as Record<string, unknown>).AND = [
        {
          OR: [
            { title: { contains: search } },
            { content: { contains: search } },
          ],
        },
      ];
    }

    const [total, documents] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" as const },
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
        },
      }),
    ]);

    const serializedDocuments = documents.map((doc) => {
      const allKnowledgeBases = [
        ...(doc.knowledgeBase ? [doc.knowledgeBase] : []),
        ...doc.knowledgeBaseLinks.map((link) => link.knowledgeBase),
      ];

      const uniqueKnowledgeBases = allKnowledgeBases.filter(
        (kb, index, self) =>
          index === self.findIndex((t) => t.id === kb.id)
      );

      return {
        ...doc,
        fileSize: doc.fileSize?.toString() || null,
        knowledgeBases: uniqueKnowledgeBases,
        knowledgeBaseLinks: undefined,
      };
    });

    return NextResponse.json(
      {
        documents: serializedDocuments,
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
    console.error("获取知识库文档列表失败:", error);
    return NextResponse.json(
      { message: "获取知识库文档列表失败，请稍后重试" },
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

    const knowledgeBaseId = params.id;

    const knowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { message: "知识库不存在" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { documentId, documentIds } = body;

    const idsToAdd: string[] = [];

    if (documentId) {
      idsToAdd.push(documentId);
    }

    if (documentIds && Array.isArray(documentIds)) {
      idsToAdd.push(...documentIds);
    }

    if (idsToAdd.length === 0) {
      return NextResponse.json(
        { message: "请提供文档ID" },
        { status: 400 }
      );
    }

    const existingDocuments = await prisma.document.findMany({
      where: { id: { in: idsToAdd }, deletedAt: null },
      select: { id: true },
    });

    const existingIds = existingDocuments.map((doc) => doc.id);
    const invalidIds = idsToAdd.filter((id) => !existingIds.includes(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { message: `文档不存在: ${invalidIds.join(", ")}` },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const docId of existingIds) {
        try {
          await tx.knowledgeBaseDocument.create({
            data: {
              documentId: docId,
              knowledgeBaseId,
            },
          });
        } catch (e) {
          console.log(`文档 ${docId} 已关联知识库 ${knowledgeBaseId}，跳过`);
        }
      }
    });

    const updatedKnowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      include: {
        documentLinks: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        _count: {
          select: { documents: true, documentLinks: true },
        },
      },
    });

    return NextResponse.json(
      {
        message: "文档已成功添加到知识库",
        knowledgeBaseId,
        documentCount: (updatedKnowledgeBase?._count.documents || 0) + (updatedKnowledgeBase?._count.documentLinks || 0),
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

    const knowledgeBaseId = params.id;

    const knowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { message: "知识库不存在" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { documentId, documentIds } = body;

    const idsToRemove: string[] = [];

    if (documentId) {
      idsToRemove.push(documentId);
    }

    if (documentIds && Array.isArray(documentIds)) {
      idsToRemove.push(...documentIds);
    }

    if (idsToRemove.length === 0) {
      return NextResponse.json(
        { message: "请提供要移除的文档ID" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const docId of idsToRemove) {
        await tx.knowledgeBaseDocument.deleteMany({
          where: {
            documentId: docId,
            knowledgeBaseId,
          },
        });

        const doc = await tx.document.findUnique({
          where: { id: docId },
        });

        if (doc && doc.knowledgeBaseId === knowledgeBaseId) {
          await tx.document.update({
            where: { id: docId },
            data: { knowledgeBaseId: null },
          });
        }
      }
    });

    const updatedKnowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      include: {
        _count: {
          select: { documents: true, documentLinks: true },
        },
      },
    });

    return NextResponse.json(
      {
        message: "文档已成功从知识库移除",
        knowledgeBaseId,
        documentCount: (updatedKnowledgeBase?._count.documents || 0) + (updatedKnowledgeBase?._count.documentLinks || 0),
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
