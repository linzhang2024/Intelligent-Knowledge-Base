import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { formatFileSize } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;
    const status = searchParams.get("status") as string | undefined;

    const documents = await prisma.document.findMany({
      where: status ? { status } : undefined,
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
      include: {
        author: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    const documentsWithFormattedSize = documents.map((doc) => ({
      ...doc,
      fileSize: doc.fileSize?.toString() || null,
      formattedSize: formatFileSize(doc.fileSize),
    }));

    return NextResponse.json(
      {
        documents: documentsWithFormattedSize,
        total: documents.length,
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
