import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title");

    if (!title) {
      return NextResponse.json(
        { message: "缺少 title 参数" },
        { status: 400 }
      );
    }

    const documents = await prisma.document.findMany({
      where: {
        title: {
          contains: title,
        },
        authorId: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        status: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            chunks: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    return NextResponse.json({
      documents: documents.map(doc => ({
        ...doc,
        fileSize: doc.fileSize?.toString() || null,
        chunkCount: doc._count.chunks,
      })),
    });

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { message: "未登录，请先登录" },
          { status: 401 }
        );
      }
    }

    console.error("查询文档失败:", error);
    return NextResponse.json(
      { message: `查询失败: ${error instanceof Error ? error.message : "未知错误"}` },
      { status: 500 }
    );
  }
}
