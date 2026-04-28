import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const [
      totalUsers,
      totalDocuments,
      totalKnowledgeBases,
      documentSizes,
    ] = await Promise.all([
      prisma.user.count({
        where: { deletedAt: null },
      }),
      prisma.document.count({
        where: { deletedAt: null },
      }),
      prisma.knowledgeBase.count(),
      prisma.document.findMany({
        where: { 
          deletedAt: null,
          fileSize: { not: null },
        },
        select: {
          fileSize: true,
        },
      }),
    ]);

    const totalStorageBytes = documentSizes.reduce((acc, doc) => {
      if (doc.fileSize) {
        return acc + Number(doc.fileSize);
      }
      return acc;
    }, 0);

    return NextResponse.json(
      {
        stats: {
          totalUsers,
          totalDocuments,
          totalKnowledgeBases,
          totalStorageBytes,
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
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { message: "无权限访问此资源" },
          { status: 403 }
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
    console.error("获取统计数据失败:", error);
    return NextResponse.json(
      { message: "获取统计数据失败，请稍后重试" },
      { status: 500 }
    );
  }
}
