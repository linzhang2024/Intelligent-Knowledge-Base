import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  generateSQLWithRAG,
  generateSQLWithRAGStream,
  SQLGenerationResult,
} from "@/lib/sqlRAG";
import { isLLMConfigured } from "@/lib/llm";
import { isEmbeddingConfigured } from "@/lib/embedding";

export interface RAGSQLGenerateRequest {
  requirement: string;
  knowledgeBaseId?: string;
  dialect?: "mysql" | "postgresql" | "sqlite" | "mssql" | "oracle";
  streaming?: boolean;
}

export interface RAGSQLGenerateResponse {
  success: boolean;
  result?: SQLGenerationResult;
  message?: string;
  tablesAvailable: number;
  searchTime?: number;
  totalTime?: number;
}

function escapeJsonString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function createSSEEvent(event: string, data: unknown): string {
  const jsonData = JSON.stringify(data);
  return `event: ${event}\ndata: ${jsonData}\n\n`;
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body: RAGSQLGenerateRequest = await request.json();
    const {
      requirement,
      knowledgeBaseId,
      dialect = "mysql",
      streaming = true,
    } = body;

    if (!requirement || requirement.trim() === "") {
      return NextResponse.json(
        { success: false, message: "报表需求不能为空", tablesAvailable: 0 },
        { status: 400 }
      );
    }

    const [embeddingConfigured, llmConfigured] = await Promise.all([
      isEmbeddingConfigured(),
      isLLMConfigured(),
    ]);

    if (!llmConfigured) {
      return NextResponse.json(
        {
          success: false,
          message: "LLM 服务未配置，无法进行 SQL 生成",
          tablesAvailable: 0,
        },
        { status: 503 }
      );
    }

    const whereClause = knowledgeBaseId ? { knowledgeBaseId } : {};
    const tablesCount = await prisma.databaseTable.count({
      where: whereClause,
    });

    if (tablesCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "当前知识库中没有可用的表结构，请先导入 SQL 文件",
          tablesAvailable: 0,
        },
        { status: 400 }
      );
    }

    console.log(
      `[RAG SQL] 用户 "${user.id}" 请求生成SQL: "${requirement.substring(0, 100)}${requirement.length > 100 ? "..." : ""}"`
    );

    const startTime = Date.now();

    if (streaming) {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(
              createSSEEvent("info", {
                message: "开始检索相关表结构...",
                tablesAvailable: tablesCount,
              })
            );

            const chatStream = await generateSQLWithRAGStream(requirement, {
              knowledgeBaseId,
              dialect,
            });

            controller.enqueue(
              createSSEEvent("info", {
                message: "正在生成 SQL...",
              })
            );

            for await (const chunk of chatStream) {
              controller.enqueue(
                createSSEEvent("content", { content: chunk })
              );
            }

            const totalTime = Date.now() - startTime;
            controller.enqueue(
              createSSEEvent("done", { totalTime, tablesAvailable: tablesCount })
            );

            controller.close();
          } catch (error) {
            console.error("[RAG SQL] 流式输出错误:", error);
            const errorMessage =
              error instanceof Error ? error.message : "未知错误";
            controller.enqueue(
              createSSEEvent("error", {
                message: errorMessage,
                errorType: "GENERATION_ERROR",
              })
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      const result = await generateSQLWithRAG(requirement, {
        knowledgeBaseId,
        dialect,
        streaming: false,
      });

      const totalTime = Date.now() - startTime;

      if (result.sql) {
        await prisma.queryHistory.create({
          data: {
            userQuery: requirement,
            generatedSQL: result.sql,
            explanation: result.explanation,
            tablesUsed: result.tablesUsed.join(","),
            knowledgeBaseId: knowledgeBaseId || null,
            userId: user.id,
            isSuccess: true,
            createdAt: new Date(),
          },
        });
      }

      const response: RAGSQLGenerateResponse = {
        success: true,
        result,
        tablesAvailable: tablesCount,
        totalTime,
      };

      console.log(`[RAG SQL] SQL生成完成，总耗时 ${totalTime}ms`);

      return NextResponse.json(response, { status: 200 });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { success: false, message: "未登录，请先登录", tablesAvailable: 0 },
          { status: 401 }
        );
      }
      if (
        error.message === "账号待审核，请联系管理员" ||
        error.message === "账号已被禁用，请联系管理员"
      ) {
        return NextResponse.json(
          { success: false, message: error.message, tablesAvailable: 0 },
          { status: 403 }
        );
      }
    }

    console.error("[RAG SQL] 生成失败:", error);
    const errorMessage =
      error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      {
        success: false,
        message: `SQL生成失败: ${errorMessage}`,
        tablesAvailable: 0,
      },
      { status: 500 }
    );
  }
}
