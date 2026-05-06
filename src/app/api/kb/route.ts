import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const currentUserId = user.id;

    const knowledgeBases = await prisma.knowledgeBase.findMany({
      where: {
        OR: [
          { ownerId: currentUserId },
          { visibility: "PUBLIC" },
        ],
      },
      orderBy: { createdAt: "desc" as const },
      select: {
        id: true,
        name: true,
        description: true,
        visibility: true,
        ownerId: true,
        createdAt: true,
        _count: {
          select: { documents: true },
        },
      },
    });

    const serializedKnowledgeBases = knowledgeBases.map((kb) => ({
      ...kb,
      documentCount: kb._count.documents,
      _count: undefined,
    }));

    return NextResponse.json(
      {
        knowledgeBases: serializedKnowledgeBases,
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
    console.error("获取知识库列表失败:", error);
    return NextResponse.json(
      { message: "获取知识库列表失败，请稍后重试" },
      { status: 500 }
    );
  }
}
