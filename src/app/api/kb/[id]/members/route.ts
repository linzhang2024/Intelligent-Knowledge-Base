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
            role: true,
            createdAt: true,
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

    const membersData = {
      knowledgeBase: {
        id: knowledgeBase.id,
        name: knowledgeBase.name,
      },
      owner: knowledgeBase.owner,
      members: [
        {
          ...knowledgeBase.owner,
          role: "OWNER",
        },
      ],
      memberCount: 1,
    };

    return NextResponse.json(membersData, { status: 200 });
  } catch (error) {
    console.error("获取知识库成员失败:", error);
    return NextResponse.json(
      { message: "获取成员信息失败，请稍后重试" },
      { status: 500 }
    );
  }
}
