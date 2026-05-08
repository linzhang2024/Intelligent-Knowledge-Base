import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return POST(request, { params });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const userId = user.id;

    const documentId = params.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        authorId: true,
        status: true,
        title: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { message: "文档不存在" },
        { status: 404 }
      );
    }

    if (document.authorId !== userId) {
      return NextResponse.json(
        { message: "您没有权限操作此文档" },
        { status: 403 }
      );
    }

    const chunkCount = await prisma.documentChunk.count({
      where: { documentId },
    });

    const doneChunkCount = await prisma.documentChunk.count({
      where: {
        documentId,
        status: "VECTOR_DONE"
      }
    });

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "DONE" },
    });

    return NextResponse.json({
      message: `已强制更新文档状态为 DONE`,
      documentId,
      totalChunks: chunkCount,
      doneChunks: doneChunkCount,
      pendingChunks: chunkCount - doneChunkCount,
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

    console.error("强制完成文档失败:", error);
    return NextResponse.json(
      { message: `操作失败: ${error instanceof Error ? error.message : "未知错误"}` },
      { status: 500 }
    );
  }
}
