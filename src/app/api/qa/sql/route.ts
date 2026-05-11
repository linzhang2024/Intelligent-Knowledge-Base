import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  generateSQLWithRAG,
  generateSQLWithRAGStream,
  SQLGenerationResult,
  EmptyKnowledgeBaseError,
  NoMatchingTablesError,
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
  errorType?: string;
  suggestions?: string[];
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

function getErrorSuggestions(errorType: string): string[] {
  switch (errorType) {
    case "EMPTY_KNOWLEDGE_BASE":
      return [
        "前往「文档管理」上传 SQL DDL 文件（CREATE TABLE 语句）",
        "确保 SQL 文件包含表结构定义（表名、字段名、字段类型、注释）",
        "上传后系统会自动解析表结构和字段信息",
      ];
    case "NO_MATCHING_TABLES":
      return [
        "尝试使用更准确的表名描述需求",
        "查看「可用表结构」列表确认可用的表名",
        "补充更多相关的表结构到知识库中",
        "简化需求描述，使用更通用的关键词",
      ];
    case "LLM_NOT_CONFIGURED":
      return [
        "前往「系统设置」配置 LLM API Key",
        "支持 OpenAI、DeepSeek、阿里云 DashScope 等多种提供商",
      ];
    case "EMBEDDING_NOT_CONFIGURED":
      return [
        "前往「系统设置」配置 Embedding 服务",
        "语义检索功能需要 Embedding 服务支持",
      ];
    default:
      return [
        "检查网络连接是否正常",
        "查看系统日志获取详细错误信息",
        "尝试重新上传 SQL 文件",
        "联系技术支持获取帮助",
      ];
  }
}

function buildErrorResponse(
  message: string,
  errorType: string,
  tablesAvailable: number = 0
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message,
      tablesAvailable,
      errorType,
      suggestions: getErrorSuggestions(errorType),
    },
    { status: errorType === "EMPTY_KNOWLEDGE_BASE" || errorType === "NO_MATCHING_TABLES" ? 400 : 500 }
  );
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let totalTablesCount = 0;
  
  try {
    const user = await requireAuth(request);

    const body: RAGSQLGenerateRequest = await request.json();
    const {
      requirement,
      knowledgeBaseId,
      dialect = "oracle",
      streaming = true,
    } = body;

    if (!requirement || requirement.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          message: "报表需求不能为空",
          tablesAvailable: 0,
          errorType: "VALIDATION_ERROR",
          suggestions: ["请输入您需要生成的报表需求描述"],
        },
        { status: 400 }
      );
    }

    const [embeddingConfigured, llmConfigured] = await Promise.all([
      isEmbeddingConfigured(),
      isLLMConfigured(),
    ]);

    if (!llmConfigured) {
      return buildErrorResponse(
        "LLM 服务未配置，无法进行 SQL 生成",
        "LLM_NOT_CONFIGURED"
      );
    }

    const tableWhereClause = knowledgeBaseId ? { knowledgeBaseId } : {};
    totalTablesCount = await prisma.databaseTable.count({
      where: tableWhereClause,
    });

    if (totalTablesCount === 0) {
      const kbMessage = knowledgeBaseId
        ? "当前选中的知识库"
        : "系统中";
      return buildErrorResponse(
        `${kbMessage}暂无 DDL 数据，请先前往「文档管理」上传 SQL 文件`,
        "EMPTY_KNOWLEDGE_BASE"
      );
    }

    console.log(
      `[RAG SQL] 前置检查通过 - 用户 "${user.id}", 需求: "${requirement.substring(0, 100)}${requirement.length > 100 ? "..." : ""}", 可用表数: ${totalTablesCount}`
    );

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
                tablesAvailable: totalTablesCount,
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
              createSSEEvent("done", { totalTime, tablesAvailable: totalTablesCount })
            );

            controller.close();
          } catch (error) {
            console.error("[RAG SQL] 流式输出错误:", error);
            
            let errorType = "GENERATION_ERROR";
            let errorMessage = "未知错误";
            
            if (error instanceof EmptyKnowledgeBaseError) {
              errorType = "EMPTY_KNOWLEDGE_BASE";
              errorMessage = error.message;
            } else if (error instanceof NoMatchingTablesError) {
              errorType = "NO_MATCHING_TABLES";
              errorMessage = error.message;
            } else if (error instanceof Error) {
              errorMessage = error.message;
            }
            
            controller.enqueue(
              createSSEEvent("error", {
                message: errorMessage,
                errorType,
                suggestions: getErrorSuggestions(errorType),
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
        tablesAvailable: totalTablesCount,
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
      if (error instanceof EmptyKnowledgeBaseError) {
        return buildErrorResponse(
          error.message,
          "EMPTY_KNOWLEDGE_BASE",
          0
        );
      }
      if (error instanceof NoMatchingTablesError) {
        return buildErrorResponse(
          error.message,
          "NO_MATCHING_TABLES",
          totalTablesCount
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
        tablesAvailable: totalTablesCount,
        errorType: "GENERATION_ERROR",
        suggestions: getErrorSuggestions("GENERATION_ERROR"),
      },
      { status: 500 }
    );
  }
}
