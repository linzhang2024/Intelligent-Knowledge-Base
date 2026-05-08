import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { resumeSingleFileRAG } from "@/lib/singleFileRAGProcessor";

export const dynamic = "force-dynamic";

export async function GET(
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
        { message: "您没有权限恢复此文档" },
        { status: 403 }
      );
    }

    if (document.status === "DONE") {
      return NextResponse.json({
        message: "文档已完成，无需恢复",
        documentId,
        processedChunks: 0,
      });
    }

    const chunkCount = await prisma.documentChunk.count({
      where: { documentId },
    });

    console.log(`[恢复API] 开始恢复文档: ${document.title} (${documentId})，共 ${chunkCount} 个 chunks`);

    const result = await resumeSingleFileRAG(documentId);

    if (result.success) {
      return NextResponse.json({
        message: `恢复成功，已处理 ${result.processedChunks} 个 chunks`,
        documentId,
        processedChunks: result.processedChunks,
        totalChunks: chunkCount,
      });
    } else {
      return NextResponse.json(
        { message: `恢复失败: ${result.error}` },
        { status: 500 }
      );
    }

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

    console.error("恢复文档失败:", error);
    return NextResponse.json(
      { message: `恢复失败: ${error instanceof Error ? error.message : "未知错误"}` },
      { status: 500 }
    );
  }
}
