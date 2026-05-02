import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  validateSQL,
  generateSQLEplanation,
  ValidationResult,
} from "@/lib/sqlParser";

export interface SQLValidateRequest {
  sql: string;
  knowledgeBaseId?: string;
}

export interface SQLValidateResponse {
  success: boolean;
  validation: ValidationResult;
  explanation?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    const body: SQLValidateRequest = await request.json();
    const { sql, knowledgeBaseId } = body;

    if (!sql || sql.trim() === "") {
      return NextResponse.json(
        { success: false, message: "SQL语句不能为空" },
        { status: 400 }
      );
    }

    const whereClause = knowledgeBaseId
      ? { knowledgeBaseId }
      : {};

    const tables = await prisma.databaseTable.findMany({
      where: whereClause,
      include: {
        columns: true,
      },
    });

    const tableMappings = tables.map(t => ({
      name: t.name,
      comment: t.tableComment,
      columns: t.columns.map(c => ({
        name: c.name,
        comment: c.columnComment,
      })),
    }));

    const tableColumns = tables.map(t => ({
      name: t.name,
      columns: t.columns.map(c => c.name),
    }));

    const validation = validateSQL(sql, tableColumns);

    const explanation = generateSQLEplanation(sql, tableMappings);

    const response: SQLValidateResponse = {
      success: true,
      validation,
      explanation,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[SQL验证API] 错误:", error);

    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { success: false, message: "未登录，请先登录" },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: `验证失败: ${error instanceof Error ? error.message : "未知错误"}`,
      },
      { status: 500 }
    );
  }
}
