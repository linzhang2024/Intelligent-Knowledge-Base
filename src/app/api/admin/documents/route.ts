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

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const status = searchParams.get("status") || "";
    const knowledgeBaseId = searchParams.get("knowledgeBaseId") || "";
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

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
    console.error("获取文档列表失败:", error);
    return NextResponse.json(
      { message: "获取文档列表失败，请稍后重试" },
      { status: 500 }
    );
  }
}
