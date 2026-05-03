import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const DOCUMENT_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export type DocumentStatus = typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS];

const VALID_STATUSES = Object.values(DOCUMENT_STATUS);

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const status = searchParams.get("status") || "";
    const knowledgeBaseId = searchParams.get("knowledgeBaseId") || "";
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (status && VALID_STATUSES.includes(status as DocumentStatus)) {
      where.status = status;
    }

    if (knowledgeBaseId) {
      where.OR = [
        { knowledgeBaseId },
        {
          knowledgeBaseLinks: {
            some: {
              knowledgeBaseId,
            },
          },
        },
      ];
    }

    if (search) {
      if (where.OR) {
        where.AND = [
          {
            OR: [
              { title: { contains: search } },
              { content: { contains: search } },
            ],
          },
        ];
      } else {
        where.OR = [
          { title: { contains: search } },
          { content: { contains: search } },
        ];
      }
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
    console.error("获取文档列表失败:", error);
    return NextResponse.json(
      { message: "获取文档列表失败，请稍后重试" },
      { status: 500 }
    );
  }
}
