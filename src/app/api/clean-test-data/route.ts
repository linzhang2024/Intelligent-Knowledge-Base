import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * 清理测试数据的 API
 * 
 * 删除：
 * 1. 最近创建的文档（标题包含 "test" 或时间戳）
 * 2. 关联的文档切片
 * 3. 导入的表、字段、关系（如果没有被其他文档使用）
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const currentUserId = user.id;

    const body = await request.json();
    const { cleanType, hours = 1 } = body || {};

    // 计算清理的时间范围
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    console.log(`[清理数据] 开始清理测试数据，用户=${currentUserId}, 时间范围=${hours}小时`);

    let deletedDocs = 0;
    let deletedChunks = 0;
    let deletedTables = 0;
    let deletedColumns = 0;
    let deletedRelations = 0;

    // 1. 删除最近的文档（带时间戳或测试标记的）
    if (cleanType === 'all' || cleanType === 'documents') {
      // 删除测试文档
      const testDocs = await prisma.document.findMany({
        where: {
          authorId: currentUserId,
          createdAt: { gte: cutoffDate },
          OR: [
            { title: { contains: 'test', mode: 'insensitive' } },
            { title: { contains: 'backup', mode: 'insensitive' } },
            { title: { contains: '拆分', mode: 'insensitive' } },
            { status: 'DRAFT' },
          ],
        },
        include: {
          chunks: true,
        },
      });

      console.log(`[清理数据] 找到 ${testDocs.length} 个测试文档`);

      for (const doc of testDocs) {
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
        
        console.log(`[清理数据] 删除文档：${doc.title}`);
      }
    }

    // 2. 删除孤立的表（没有被文档引用的）
    if (cleanType === 'all' || cleanType === 'tables') {
      const orphanTables = await prisma.table.findMany({
        where: {
          ownerId: currentUserId,
          createdAt: { gte: cutoffDate },
          documentChunks: {
            none: {}, // 没有关联任何文档切片
          },
        },
        include: {
          columns: true,
          relations: true,
        },
      });

      console.log(`[清理数据] 找到 ${orphanTables.length} 个孤立表`);

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
        
        console.log(`[清理数据] 删除孤立表：${table.name}`);
      }
    }

    // 3. 删除孤立的列（没有被引用的）
    if (cleanType === 'all' || cleanType === 'columns') {
      const orphanColumns = await prisma.column.findMany({
        where: {
          ownerId: currentUserId,
          createdAt: { gte: cutoffDate },
          documentChunks: {
            none: {},
          },
        },
      });

      console.log(`[清理数据] 找到 ${orphanColumns.length} 个孤立列`);

      for (const column of orphanColumns) {
        await prisma.column.delete({
          where: { id: column.id },
        });
        deletedColumns++;
      }
    }

    // 4. 删除孤立的关系
    if (cleanType === 'all' || cleanType === 'relations') {
      const orphanRelations = await prisma.relation.findMany({
        where: {
          ownerId: currentUserId,
          createdAt: { gte: cutoffDate },
          documentChunks: {
            none: {},
          },
        },
      });

      console.log(`[清理数据] 找到 ${orphanRelations.length} 个孤立关系`);

      for (const relation of orphanRelations) {
        await prisma.relation.delete({
          where: { id: relation.id },
        });
        deletedRelations++;
      }
    }

    // 5. 删除孤立的文档切片
    if (cleanType === 'all' || cleanType === 'chunks') {
      const orphanChunks = await prisma.documentChunk.findMany({
        where: {
          createdAt: { gte: cutoffDate },
          document: null, // 没有关联文档
        },
      });

      console.log(`[清理数据] 找到 ${orphanChunks.length} 个孤立切片`);

      for (const chunk of orphanChunks) {
        await prisma.documentChunk.delete({
          where: { id: chunk.id },
        });
        deletedChunks++;
      }
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
      message: `清理完成：删除 ${deletedDocs} 个文档，${deletedChunks} 个切片，${deletedTables} 个表，${deletedColumns} 个列，${deletedRelations} 个关系`,
    };

    console.log(`[清理数据] ${result.message}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("清理数据失败:", error);
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

// GET - 查看统计数据
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const currentUserId = user.id;

    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "24");
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    // 统计数据
    const docCount = await prisma.document.count({
      where: {
        authorId: currentUserId,
        createdAt: { gte: cutoffDate },
      },
    });

    const chunkCount = await prisma.documentChunk.count({
      where: {
        document: {
          authorId: currentUserId,
        },
        createdAt: { gte: cutoffDate },
      },
    });

    const tableCount = await prisma.table.count({
      where: {
        ownerId: currentUserId,
        createdAt: { gte: cutoffDate },
      },
    });

    const columnCount = await prisma.column.count({
      where: {
        ownerId: currentUserId,
        createdAt: { gte: cutoffDate },
      },
    });

    const relationCount = await prisma.relation.count({
      where: {
        ownerId: currentUserId,
        createdAt: { gte: cutoffDate },
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        documents: docCount,
        chunks: chunkCount,
        tables: tableCount,
        columns: columnCount,
        relations: relationCount,
      },
      timeRange: {
        hours,
        from: cutoffDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("查询统计数据失败:", error);
    return NextResponse.json(
      { message: "查询失败", error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}
