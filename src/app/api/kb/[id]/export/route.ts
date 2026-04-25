import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = getCurrentUserId(request);
    
    if (!currentUserId) {
      return NextResponse.json(
        { message: "未登录，请先登录" },
        { status: 401 }
      );
    }

    const kbId = params.id;

    const knowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        documents: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { message: "知识库不存在" },
        { status: 404 }
      );
    }

    if (knowledgeBase.ownerId !== currentUserId) {
      return NextResponse.json(
        { message: "无权限访问此知识库" },
        { status: 403 }
      );
    }

    const exportData = {
      knowledgeBase: {
        id: knowledgeBase.id,
        name: knowledgeBase.name,
        description: knowledgeBase.description,
        createdAt: knowledgeBase.createdAt.toISOString(),
        owner: knowledgeBase.owner,
      },
      documents: knowledgeBase.documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        fileUrl: doc.fileUrl,
        fileType: doc.fileType,
        fileSize: doc.fileSize?.toString() || null,
        status: doc.status,
        author: doc.author,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      })),
      exportMeta: {
        exportedAt: new Date().toISOString(),
        documentCount: knowledgeBase.documents.length,
      },
    };

    return NextResponse.json(exportData, { status: 200 });
  } catch (error) {
    console.error("导出知识库失败:", error);
    return NextResponse.json(
      { message: "导出失败，请稍后重试" },
      { status: 500 }
    );
  }
}
