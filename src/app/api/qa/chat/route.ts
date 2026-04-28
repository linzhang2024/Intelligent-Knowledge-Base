import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { semanticSearch, SearchResult } from "@/lib/vectorStore";
import { chatWithRAGStream, chatWithRAG, isLLMConfigured, ChatMessage } from "@/lib/llm";
import { isEmbeddingConfigured } from "@/lib/embedding";

export interface ChatRequest {
  message: string;
  knowledgeBaseId?: string;
  limit?: number;
  minSimilarity?: number;
  streaming?: boolean;
  history?: ChatMessage[];
}

export interface ChatSource {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  knowledgeBaseId: string | null;
  knowledgeBaseName: string | null;
  similarity: number;
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  searchTime?: number;
  totalTime?: number;
}

export const dynamic = "force-dynamic";

function buildSources(results: SearchResult[]): ChatSource[] {
  return results.map((result) => ({
    chunkId: result.chunkId,
    documentId: result.documentId,
    documentTitle: result.documentTitle,
    knowledgeBaseId: result.knowledgeBaseId,
    knowledgeBaseName: result.knowledgeBaseName,
    similarity: result.similarity,
    snippet: result.content.substring(0, 150) + (result.content.length > 150 ? "..." : ""),
  }));
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

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    if (!isEmbeddingConfigured()) {
      return NextResponse.json(
        { message: "Embedding 服务未配置，无法进行语义检索" },
        { status: 503 }
      );
    }

    if (!isLLMConfigured()) {
      return NextResponse.json(
        { message: "LLM 服务未配置，无法进行对话" },
        { status: 503 }
      );
    }

    const body: ChatRequest = await request.json();
    const {
      message,
      knowledgeBaseId,
      limit = 5,
      minSimilarity = 0.5,
      streaming = true,
      history = [],
    } = body;

    if (!message || message.trim() === "") {
      return NextResponse.json(
        { message: "message 参数不能为空" },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    console.log(
      `[RAG Chat] 用户 "${user.id}" 提问: "${message}"`
    );

    const searchStartTime = Date.now();
    const searchResults = await semanticSearch(message, {
      knowledgeBaseId: knowledgeBaseId || undefined,
      limit: Math.min(limit, 10),
      minSimilarity: Math.max(minSimilarity, 0.1),
      userId: user.id,
    });
    const searchTime = Date.now() - searchStartTime;

    console.log(
      `[RAG Chat] 语义检索完成，找到 ${searchResults.length} 个相关片段，耗时 ${searchTime}ms`
    );

    const sources = buildSources(searchResults);

    if (streaming) {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(
              createSSEEvent("sources", { sources, searchTime })
            );

            const chatStream = await chatWithRAGStream(
              message,
              searchResults,
              { streaming: true },
              history
            );

            for await (const chunk of chatStream) {
              controller.enqueue(
                createSSEEvent("content", { content: chunk })
              );
            }

            const totalTime = Date.now() - startTime;
            controller.enqueue(
              createSSEEvent("done", { totalTime })
            );

            controller.close();
          } catch (error) {
            console.error("[RAG Chat] 流式输出错误:", error);
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            controller.enqueue(
              createSSEEvent("error", { message: errorMessage })
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } else {
      const answer = await chatWithRAG(
        message,
        searchResults,
        { streaming: false },
        history
      );

      const totalTime = Date.now() - startTime;

      const response: ChatResponse = {
        answer,
        sources,
        searchTime,
        totalTime,
      };

      console.log(`[RAG Chat] 对话完成，总耗时 ${totalTime}ms`);

      return NextResponse.json(response, { status: 200 });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { message: "未登录，请先登录" },
          { status: 401 }
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

    console.error("[RAG Chat] 对话失败:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      { message: `对话失败: ${errorMessage}` },
      { status: 500 }
    );
  }
}
