import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  generateSQLFromRequirement,
  parseReportRequirement,
  GeneratedSQL,
  SQLElements,
  AmbiguousPart,
} from "@/lib/sqlParser";

export interface SQLGenerateRequest {
  requirement: string;
  knowledgeBaseId?: string;
  dialect?: "mysql" | "postgresql" | "sqlite" | "mssql" | "oracle";
  includeComments?: boolean;
  useAlias?: boolean;
}

export interface SQLGenerateResponse {
  success: boolean;
  parsedElements?: SQLElements;
  sqlCandidates: GeneratedSQL[];
  ambiguousParts: AmbiguousPart[];
  confidence: number;
  tablesAvailable: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    const body: SQLGenerateRequest = await request.json();
    const {
      requirement,
      knowledgeBaseId,
      dialect = "mysql",
      includeComments = true,
      useAlias = true,
    } = body;

    if (!requirement || requirement.trim() === "") {
      return NextResponse.json(
        { success: false, message: "报表需求不能为空" },
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
        relationsFrom: true,
        relationsTo: true,
      },
    });

    if (tables.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "当前知识库中没有可用的表结构，请先导入SQL文件",
          tablesAvailable: 0,
        },
        { status: 400 }
      );
    }

    const tableMappings = tables.map(t => ({
      name: t.name,
      comment: t.tableComment,
      columns: t.columns.map(c => ({
        name: c.name,
        comment: c.columnComment,
      })),
    }));

    const parsed = parseReportRequirement(requirement, tableMappings);

    const generatedSQLs = await generateSQLFromRequirement(
      requirement,
      knowledgeBaseId,
      {
        dialect,
        includeComments,
        useAlias,
      }
    );

    await prisma.queryHistory.create({
      data: {
        userQuery: requirement,
        generatedSQL: generatedSQLs[0]?.sql || "",
        tablesUsed: generatedSQLs[0]?.tablesUsed || [],
        knowledgeBaseId: knowledgeBaseId || null,
        userId: user.id,
        createdAt: new Date(),
      },
    });

    const response: SQLGenerateResponse = {
      success: true,
      parsedElements: parsed.parsedElements,
      sqlCandidates: generatedSQLs,
      ambiguousParts: parsed.ambiguousParts,
      confidence: parsed.confidence,
      tablesAvailable: tables.length,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[SQL生成API] 错误:", error);

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
        message: `生成失败: ${error instanceof Error ? error.message : "未知错误"}`,
      },
      { status: 500 }
    );
  }
}
