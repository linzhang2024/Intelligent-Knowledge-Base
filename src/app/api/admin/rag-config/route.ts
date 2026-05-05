import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getPublicRAGConfig,
  saveRAGConfig,
  RAGConfig,
} from "@/lib/ragConfig";

function validateRAGConfig(config: Partial<RAGConfig>): { valid: boolean; message?: string } {
  if (config.chunkSize !== undefined && (config.chunkSize < 100 || config.chunkSize > 50000)) {
    return { valid: false, message: "普通文档分块大小必须在 100-50000 之间" };
  }
  if (config.chunkOverlap !== undefined && (config.chunkOverlap < 0 || config.chunkOverlap > 5000)) {
    return { valid: false, message: "普通文档分块重叠必须在 0-5000 之间" };
  }
  if (config.maxSingleChunkSize !== undefined && (config.maxSingleChunkSize < 100 || config.maxSingleChunkSize > 100000)) {
    return { valid: false, message: "普通文档最大单块大小必须在 100-100000 之间" };
  }
  if (config.sqlChunkSize !== undefined && (config.sqlChunkSize < 100 || config.sqlChunkSize > 100000)) {
    return { valid: false, message: "SQL文档分块大小必须在 100-100000 之间" };
  }
  if (config.sqlChunkOverlap !== undefined && (config.sqlChunkOverlap < 0 || config.sqlChunkOverlap > 5000)) {
    return { valid: false, message: "SQL文档分块重叠必须在 0-5000 之间" };
  }
  if (config.sqlMaxSingleChunkSize !== undefined && (config.sqlMaxSingleChunkSize < 100 || config.sqlMaxSingleChunkSize > 200000)) {
    return { valid: false, message: "SQL文档最大单块大小必须在 100-200000 之间" };
  }
  
  if (config.chunkSize !== undefined && config.chunkOverlap !== undefined && config.chunkOverlap >= config.chunkSize) {
    return { valid: false, message: "普通文档分块重叠不能大于或等于分块大小" };
  }
  if (config.sqlChunkSize !== undefined && config.sqlChunkOverlap !== undefined && config.sqlChunkOverlap >= config.sqlChunkSize) {
    return { valid: false, message: "SQL文档分块重叠不能大于或等于分块大小" };
  }

  return { valid: true };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const config = await getPublicRAGConfig();

    return NextResponse.json(
      {
        config,
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
    }
    console.error("获取 RAG 配置失败:", error);
    return NextResponse.json(
      { message: "获取 RAG 配置失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const {
      chunkSize,
      chunkOverlap,
      maxSingleChunkSize,
      sqlChunkSize,
      sqlChunkOverlap,
      sqlMaxSingleChunkSize,
    } = body;

    const updateData: Partial<RAGConfig> = {};

    if (chunkSize !== undefined) updateData.chunkSize = Number(chunkSize);
    if (chunkOverlap !== undefined) updateData.chunkOverlap = Number(chunkOverlap);
    if (maxSingleChunkSize !== undefined) updateData.maxSingleChunkSize = Number(maxSingleChunkSize);
    if (sqlChunkSize !== undefined) updateData.sqlChunkSize = Number(sqlChunkSize);
    if (sqlChunkOverlap !== undefined) updateData.sqlChunkOverlap = Number(sqlChunkOverlap);
    if (sqlMaxSingleChunkSize !== undefined) updateData.sqlMaxSingleChunkSize = Number(sqlMaxSingleChunkSize);

    const validation = validateRAGConfig(updateData);
    if (!validation.valid) {
      return NextResponse.json(
        { message: validation.message },
        { status: 400 }
      );
    }

    await saveRAGConfig(updateData);

    const updatedConfig = await getPublicRAGConfig();

    return NextResponse.json(
      {
        message: "RAG 配置保存成功，新配置将立即生效",
        config: updatedConfig,
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
    }
    console.error("保存 RAG 配置失败:", error);
    return NextResponse.json(
      { message: "保存 RAG 配置失败，请稍后重试" },
      { status: 500 }
    );
  }
}
