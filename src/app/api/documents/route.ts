import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DOCUMENT_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

type DocumentStatus = typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS];

const VALID_STATUSES = Object.values(DOCUMENT_STATUS);

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const status = searchParams.get("status") || "";
    const knowledgeBaseId = searchParams.get("knowledgeBaseId") || "";
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
      authorId: user.id,
    };

    if (status && VALID_STATUSES.includes(status as DocumentStatus)) {
      where.status = status;
    }

    if (knowledgeBaseId) {
      where.knowledgeBaseId = knowledgeBaseId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
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
          knowledgeBase: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const serializedDocuments = documents.map((doc) => ({
      ...doc,
      fileSize: doc.fileSize?.toString() || null,
    }));

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
