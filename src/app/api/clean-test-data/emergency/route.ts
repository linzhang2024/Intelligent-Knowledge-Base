import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * 紧急清理上一轮测试数据的 API
 * 专门清理串行上传时产生的测试数据
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const currentUserId = user.id;

    console.log(`[紧急清理] 开始清理上一轮测试数据，用户=${currentUserId}`);

    let deletedDocs = 0;
    let deletedChunks = 0;
    let deletedTables = 0;
    let deletedColumns = 0;
    let deletedRelations = 0;

    // 1. 删除所有 DRAFT 状态的文档（测试文档）
    const draftDocs = await prisma.document.findMany({
      where: {
        authorId: currentUserId,
        status: 'DRAFT',
      },
      include: {
        chunks: true,
      },
    });

    console.log(`[紧急清理] 找到 ${draftDocs.length} 个 DRAFT 状态的文档`);

    for (const doc of draftDocs) {
      // 删除关联的切片
      await prisma.documentChunk.deleteMany({
        where: { documentId: doc.id },
      });
      deletedChunks += doc.chunks.length;

      // 删除文档
      await prisma.document.delete({
        where: { id: doc.id },
      });
      deletedDocs++;
      
      console.log(`[紧急清理] 删除 DRAFT 文档：${doc.title} (ID: ${doc.id})`);
    }

    // 2. 删除最近 1 小时内创建的所有文档（可能是测试数据）
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentDocs = await prisma.document.findMany({
      where: {
        authorId: currentUserId,
        createdAt: { gte: oneHourAgo },
        fileType: 'SQL',
      },
      include: {
        chunks: true,
      },
    });

    console.log(`[紧急清理] 找到 ${recentDocs.length} 个最近创建的 SQL 文档`);

    for (const doc of recentDocs) {
      // 跳过已经删除的
      if (draftDocs.some(d => d.id === doc.id)) {
        continue;
      }

      // 删除关联的切片
      await prisma.documentChunk.deleteMany({
        where: { documentId: doc.id },
      });
      deletedChunks += doc.chunks.length;

      // 删除文档
      await prisma.document.delete({
        where: { id: doc.id },
      });
      deletedDocs++;
      
      console.log(`[紧急清理] 删除最近创建的文档：${doc.title} (ID: ${doc.id})`);
    }

    // 3. 删除孤立的表（没有关联任何文档的）
    const orphanTables = await prisma.table.findMany({
      where: {
        ownerId: currentUserId,
        createdAt: { gte: oneHourAgo },
        documentChunks: {
          none: {},
        },
      },
      include: {
        columns: true,
        relations: true,
      },
    });

    console.log(`[紧急清理] 找到 ${orphanTables.length} 个孤立表`);

    for (const table of orphanTables) {
      // 删除关联的列
      await prisma.column.deleteMany({
        where: { tableId: table.id },
      });
      deletedColumns += table.columns.length;

      // 删除关联的关系
      await prisma.relation.deleteMany({
        where: {
          OR: [
            { tableId: table.id },
            { relatedTableId: table.id },
          ],
        },
      });
      deletedRelations += table.relations.length;

      // 删除表
      await prisma.table.delete({
        where: { id: table.id },
      });
      deletedTables++;
      
      console.log(`[紧急清理] 删除孤立表：${table.name} (ID: ${table.id})`);
    }

    // 4. 删除孤立的列
    const orphanColumns = await prisma.column.findMany({
      where: {
        ownerId: currentUserId,
        createdAt: { gte: oneHourAgo },
        documentChunks: {
          none: {},
        },
      },
    });

    console.log(`[紧急清理] 找到 ${orphanColumns.length} 个孤立列`);

    for (const column of orphanColumns) {
      await prisma.column.delete({
        where: { id: column.id },
      });
      deletedColumns++;
    }

    // 5. 删除孤立的关系
    const orphanRelations = await prisma.relation.findMany({
      where: {
        ownerId: currentUserId,
        createdAt: { gte: oneHourAgo },
        documentChunks: {
          none: {},
        },
      },
    });

    console.log(`[紧急清理] 找到 ${orphanRelations.length} 个孤立关系`);

    for (const relation of orphanRelations) {
      await prisma.relation.delete({
        where: { id: relation.id },
      });
      deletedRelations++;
    }

    // 6. 删除孤立的文档切片
    const orphanChunks = await prisma.documentChunk.findMany({
      where: {
        createdAt: { gte: oneHourAgo },
        documentId: null,
      },
    });

    console.log(`[紧急清理] 找到 ${orphanChunks.length} 个孤立切片`);

    for (const chunk of orphanChunks) {
      await prisma.documentChunk.delete({
        where: { id: chunk.id },
      });
      deletedChunks++;
    }

    const result = {
      success: true,
      summary: {
        deletedDocs,
        deletedChunks,
        deletedTables,
        deletedColumns,
        deletedRelations,
      },
      message: `清理完成！共删除：${deletedDocs} 个文档，${deletedChunks} 个切片，${deletedTables} 个表，${deletedColumns} 个列，${deletedRelations} 个关系`,
    };

    console.log(`[紧急清理] ${result.message}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("紧急清理失败:", error);
    return NextResponse.json(
      { 
        message: "清理失败", 
        error: error instanceof Error ? error.message : "未知错误",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
