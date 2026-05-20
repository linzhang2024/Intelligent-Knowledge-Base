import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { deleteEmbeddingsByDocumentId } from "@/lib/vectorStore";
import { importSQLFile, SQLImportResult } from "@/lib/sqlParser";
import { detectSQLDialect } from "@/lib/documentParser";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ message: "documentId 不能为空" }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId, deletedAt: null },
    });

    if (!document) {
      return NextResponse.json({ message: "文档不存在或已删除" }, { status: 404 });
    }

    if (!document.content) {
      return NextResponse.json({ message: "文档内容为空，无法导入SQL" }, { status: 400 });
    }

    const isSQLFile = (document.fileType || "").toUpperCase() === "SQL";
    if (!isSQLFile) {
      return NextResponse.json({ message: "该文档不是SQL类型" }, { status: 400 });
    }

    // 先删除旧的 databaseTable 关联（如果有的话）
    const existingTables = await prisma.databaseTable.findMany({
      where: { documentId },
      select: { id: true, name: true },
    });

    if (existingTables.length > 0) {
      console.log(`[SQL重导入] 删除旧的 ${existingTables.length} 个表关联: ${existingTables.map(t => t.name).join(", ")}`);
      
      // 删除关系
      await prisma.tableRelation.deleteMany({
        where: {
          OR: [
            { fromTableId: { in: existingTables.map(t => t.id) } },
            { toTableId: { in: existingTables.map(t => t.id) } },
          ],
        },
      });
      
      // 删除列
      await prisma.tableColumn.deleteMany({
        where: { tableId: { in: existingTables.map(t => t.id) } },
      });
      
      // 删除表
      await prisma.databaseTable.deleteMany({
        where: { documentId },
      });
    }

    // 检测方言并导入
    const dialect = detectSQLDialect(document.content);
    console.log(`[SQL重导入] 文档 "${document.title}" 检测方言: ${dialect}, 内容长度: ${document.content.length}`);

    const result: SQLImportResult = await importSQLFile(document.content, {
      knowledgeBaseId: document.knowledgeBaseId || undefined,
      documentId: document.id,
      userId: document.authorId || undefined,
      overwriteExisting: true,
      inferRelations: true,
      dialect,
    });

    console.log(`[SQL重导入] 完成: 表=${result.tablesImported}, 列=${result.columnsImported}, 关系=${result.relationsImported}`);

    if (result.errors.length > 0) {
      console.log(`[SQL重导入] 错误: ${result.errors.join(", ")}`);
    }
    if (result.warnings.length > 0) {
      console.log(`[SQL重导入] 警告: ${result.warnings.join(", ")}`);
    }

    return NextResponse.json({
      success: result.success,
      tablesImported: result.tablesImported,
      columnsImported: result.columnsImported,
      relationsImported: result.relationsImported,
      tableNames: result.tableNames,
      errors: result.errors,
      warnings: result.warnings,
      dialect,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json({ message: "未登录，请先登录" }, { status: 401 });
      }
      if (error.message === "无权限访问此资源") {
        return NextResponse.json({ message: "无权限访问此资源" }, { status: 403 });
      }
    }
    console.error("[SQL重导入] 失败:", error);
    return NextResponse.json(
      {
        message: `SQL导入失败: ${error instanceof Error ? error.message : "未知错误"}`,
        success: false,
      },
      { status: 500 }
    );
  }
}