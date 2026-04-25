import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { formatFileSize } from "@/lib/utils";

interface DocumentDetailParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: DocumentDetailParams) {
  try {
    const documentId = params.id;

    const document = await prisma.document.findUnique({
      where: {
        id: documentId,
      },
      include: {
        author: {
          select: {
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
    });

    if (!document) {
      return NextResponse.json(
        { message: "文档不存在" },
        { status: 404 }
      );
    }

    const documentWithFormattedSize = {
      ...document,
      fileSize: document.fileSize?.toString() || null,
      formattedSize: formatFileSize(document.fileSize),
    };

    return NextResponse.json(
      {
        document: documentWithFormattedSize,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("获取文档详情失败:", error);
    return NextResponse.json(
      { message: "获取文档详情失败，请稍后重试" },
      { status: 500 }
    );
  }
}
