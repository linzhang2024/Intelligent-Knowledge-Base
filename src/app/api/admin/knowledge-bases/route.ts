import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [total, knowledgeBases] = await Promise.all([
      prisma.knowledgeBase.count({ where }),
      prisma.knowledgeBase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" as const },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: { documents: true },
          },
        },
      }),
    ]);

    const serializedKnowledgeBases = knowledgeBases.map((kb) => ({
      ...kb,
      documentCount: kb._count.documents,
      _count: undefined,
    }));

    return NextResponse.json(
      {
        knowledgeBases: serializedKnowledgeBases,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
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
    console.error("获取知识库列表失败:", error);
    return NextResponse.json(
      { message: "获取知识库列表失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { name, description, ownerId } = body;

    if (!name) {
      return NextResponse.json(
        { message: "知识库名称不能为空" },
        { status: 400 }
      );
    }

    const newKnowledgeBase = await prisma.knowledgeBase.create({
      data: {
        name,
        description: description || null,
        ownerId: ownerId || (request.cookies.get("kb_user_id")?.value || ""),
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { documents: true },
        },
      },
    });

    return NextResponse.json(
      {
        message: "知识库创建成功",
        knowledgeBase: {
          ...newKnowledgeBase,
          documentCount: newKnowledgeBase._count.documents,
          _count: undefined,
        },
      },
      { status: 201 }
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
    console.error("创建知识库失败:", error);
    return NextResponse.json(
      { message: "创建知识库失败，请稍后重试" },
      { status: 500 }
    );
  }
}
