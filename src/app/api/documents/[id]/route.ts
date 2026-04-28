import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;

    const document = await prisma.document.findUnique({
      where: {
        id: documentId,
      },
      include: {
        chunks: {
          orderBy: {
            index: "asc",
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

    const response = {
      document: {
        id: document.id,
        title: document.title,
        content: document.content,
        fileUrl: document.fileUrl,
        fileType: document.fileType,
        fileSize: document.fileSize?.toString() || null,
        status: document.status,
        authorId: document.authorId,
        knowledgeBaseId: document.knowledgeBaseId,
        knowledgeBaseName: document.knowledgeBase?.name || null,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
        chunks: document.chunks.map((chunk) => ({
          id: chunk.id,
          index: chunk.index,
          content: chunk.content,
          createdAt: chunk.createdAt.toISOString(),
          updatedAt: chunk.updatedAt.toISOString(),
        })),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("获取文档详情失败:", error);
    return NextResponse.json(
      { message: "获取文档详情失败" },
      { status: 500 }
    );
  }
}
