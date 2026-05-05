import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deserializeVector } from "@/lib/embedding";
import { isMilvusEnabled } from "@/lib/milvusConfig";
import {
  insertMilvusVectors,
  deleteMilvusVectorsByDocumentId,
  getMilvusStats,
} from "@/lib/milvusClient";

let migrationStatus: {
  isRunning: boolean;
  total: number;
  processed: number;
  errors: number;
  startTime?: Date;
  endTime?: Date;
  errorMessage?: string;
} = {
  isRunning: false,
  total: 0,
  processed: 0,
  errors: 0,
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const enabled = await isMilvusEnabled();
    const stats = await getMilvusStats();

    return NextResponse.json(
      {
        enabled,
        milvusStats: stats,
        migrationStatus,
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
    console.error("获取迁移状态失败:", error);
    return NextResponse.json(
      { message: "获取迁移状态失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const enabled = await isMilvusEnabled();
    if (!enabled) {
      return NextResponse.json(
        { message: "Milvus 未启用，请先在系统设置中启用 Milvus" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, documentId } = body;

    if (action === "start") {
      if (migrationStatus.isRunning) {
        return NextResponse.json(
          { message: "迁移任务正在进行中，请稍后再试" },
          { status: 400 }
        );
      }

      startMigration();

      return NextResponse.json(
        {
          message: "迁移任务已启动",
          migrationStatus: {
            ...migrationStatus,
            isRunning: true,
          },
        },
        { status: 200 }
      );
    }

    if (action === "migrateDocument") {
      if (!documentId) {
        return NextResponse.json(
          { message: "缺少 documentId 参数" },
          { status: 400 }
        );
      }

      const result = await migrateSingleDocument(documentId);

      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (action === "clearAll") {
      const result = await clearAllMilvusData();

      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (action === "clearDocument") {
      if (!documentId) {
        return NextResponse.json(
          { message: "缺少 documentId 参数" },
          { status: 400 }
        );
      }

      const result = await deleteMilvusVectorsByDocumentId(documentId);

      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    return NextResponse.json(
      { message: "未知的操作类型" },
      { status: 400 }
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
    console.error("Milvus 迁移操作失败:", error);
    return NextResponse.json(
      { message: "操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}

async function startMigration() {
  migrationStatus = {
    isRunning: true,
    total: 0,
    processed: 0,
    errors: 0,
    startTime: new Date(),
  };

  migrateAllData().catch((error) => {
    console.error("迁移任务失败:", error);
    migrationStatus.isRunning = false;
    migrationStatus.errorMessage = error instanceof Error ? error.message : "未知错误";
    migrationStatus.endTime = new Date();
  });
}

async function migrateAllData() {
  const totalChunks = await prisma.documentChunk.count({
    where: {
      embedding: { not: null },
    },
  });

  migrationStatus.total = totalChunks;
  migrationStatus.processed = 0;
  migrationStatus.errors = 0;

  const batchSize = 100;
  let skip = 0;

  while (true) {
    const chunks = await prisma.documentChunk.findMany({
      where: {
        embedding: { not: null },
      },
      select: {
        id: true,
        documentId: true,
        index: true,
        content: true,
        embedding: true,
        embeddingModel: true,
        document: {
          select: {
            knowledgeBaseId: true,
          },
        },
      },
      skip,
      take: batchSize,
      orderBy: { id: "asc" },
    });

    if (chunks.length === 0) {
      break;
    }

    const vectorsToInsert = [];

    for (const chunk of chunks) {
      try {
        if (!chunk.embedding) continue;

        const vector = deserializeVector(chunk.embedding);

        vectorsToInsert.push({
          id: chunk.id,
          chunkId: chunk.id,
          documentId: chunk.documentId,
          knowledgeBaseId: chunk.document.knowledgeBaseId,
          content: chunk.content,
          embedding: vector,
          model: chunk.embeddingModel || "unknown",
        });
      } catch (error) {
        console.error(`[Migration] 解析向量失败: ${chunk.id}`, error);
        migrationStatus.errors++;
      }
    }

    if (vectorsToInsert.length > 0) {
      const result = await insertMilvusVectors(vectorsToInsert);

      if (result.success) {
        migrationStatus.processed += result.insertedCount;
      } else {
        migrationStatus.errors += vectorsToInsert.length;
        console.error(`[Migration] 批次插入失败: ${result.message}`);
      }
    }

    skip += batchSize;
  }

  migrationStatus.isRunning = false;
  migrationStatus.endTime = new Date();

  console.log(`[Migration] 迁移完成: 总计 ${migrationStatus.total}, 成功 ${migrationStatus.processed}, 失败 ${migrationStatus.errors}`);
}

async function migrateSingleDocument(documentId: string): Promise<{
  success: boolean;
  message: string;
  processed?: number;
  errors?: number;
}> {
  const chunks = await prisma.documentChunk.findMany({
    where: {
      documentId,
      embedding: { not: null },
    },
    select: {
      id: true,
      documentId: true,
      index: true,
      content: true,
      embedding: true,
      embeddingModel: true,
      document: {
        select: {
          knowledgeBaseId: true,
        },
      },
    },
    orderBy: { index: "asc" },
  });

  if (chunks.length === 0) {
    return {
      success: false,
      message: "该文档没有已向量化的片段",
    };
  }

  await deleteMilvusVectorsByDocumentId(documentId);

  const vectorsToInsert = [];
  let errors = 0;

  for (const chunk of chunks) {
    try {
      if (!chunk.embedding) continue;

      const vector = deserializeVector(chunk.embedding);

      vectorsToInsert.push({
        id: chunk.id,
        chunkId: chunk.id,
        documentId: chunk.documentId,
        knowledgeBaseId: chunk.document.knowledgeBaseId,
        content: chunk.content,
        embedding: vector,
        model: chunk.embeddingModel || "unknown",
      });
    } catch (error) {
      console.error(`[Migration] 解析向量失败: ${chunk.id}`, error);
      errors++;
    }
  }

  if (vectorsToInsert.length === 0) {
    return {
      success: false,
      message: "没有有效的向量数据可以迁移",
      errors,
    };
  }

  const result = await insertMilvusVectors(vectorsToInsert);

  if (result.success) {
    return {
      success: true,
      message: `成功迁移 ${result.insertedCount} 个向量`,
      processed: result.insertedCount,
      errors,
    };
  } else {
    return {
      success: false,
      message: `迁移失败: ${result.message}`,
      processed: 0,
      errors: vectorsToInsert.length + errors,
    };
  }
}

async function clearAllMilvusData(): Promise<{
  success: boolean;
  message: string;
}> {
  const stats = await getMilvusStats();
  
  return {
    success: true,
    message: `Milvus 中共有 ${stats.totalVectors} 个向量。要清除所有数据，请先初始化集合或使用单独的文档删除操作。`,
  };
}
