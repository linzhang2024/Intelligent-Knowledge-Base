import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { semanticSearch, SearchResult, EmbeddingTimeoutError, EmptyVectorStoreError } from "@/lib/vectorStore";
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
    
    const body: ChatRequest = await request.json();
    const {
      message,
      knowledgeBaseId,
      limit = 5,
      minSimilarity = 0.38,
      streaming = true,
      history = [],
    } = body;

    if (!message || message.trim() === "") {
      return NextResponse.json(
        { message: "message 参数不能为空", errorType: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const [embeddingConfigured, llmConfigured] = await Promise.all([
      isEmbeddingConfigured(),
      isLLMConfigured(),
    ]);

    if (!embeddingConfigured) {
      return NextResponse.json(
        { message: "Embedding 服务未配置，无法进行语义检索", errorType: "SERVICE_UNAVAILABLE" },
        { status: 503 }
      );
    }

    if (!llmConfigured) {
      return NextResponse.json(
        { message: "LLM 服务未配置，无法进行对话", errorType: "SERVICE_UNAVAILABLE" },
        { status: 503 }
      );
    }

    const startTime = Date.now();

    console.log(
      `[RAG Chat] 用户 "${user.id}" 提问: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`
    );

    if (streaming) {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let searchResults: SearchResult[] = [];
            let searchTime = 0;
            
            try {
              const effectiveMinSimilarity = Math.max(minSimilarity || 0.38, 0.1);
              const searchStartTime = Date.now();
              searchResults = await semanticSearch(message, {
                knowledgeBaseId: knowledgeBaseId || undefined,
                limit: Math.min(limit, 10),
                minSimilarity: effectiveMinSimilarity,
                userId: user.id,
              });
              searchTime = Date.now() - searchStartTime;

              const topSimilarity = searchResults.length > 0
                ? (Math.max(...searchResults.map(r => r.similarity)) * 100).toFixed(1)
                : "0";
              const resultDetails = searchResults.map((r, i) =>
                `  #${i + 1}: ${(r.similarity * 100).toFixed(1)}% - ${r.documentTitle}\n    内容: ${r.content.substring(0, 100)}...`
              ).join('\n');

              console.log(
                `[RAG Chat] 语义检索完成，找到 ${searchResults.length} 个相关片段，阈值 ${(effectiveMinSimilarity * 100).toFixed(0)}%，最高匹配 ${topSimilarity}%，耗时 ${searchTime}ms\n${resultDetails}`
              );
            } catch (searchError) {
              console.error("[RAG Chat] 语义检索失败:", searchError);
              
              let errorMessage: string;
              let errorType: string;
              
              if (searchError instanceof EmptyVectorStoreError) {
                errorMessage = searchError.message;
                errorType = "EMPTY_VECTOR_STORE";
              } else if (searchError instanceof EmbeddingTimeoutError) {
                errorMessage = searchError.message;
                errorType = "EMBEDDING_TIMEOUT";
              } else {
                errorMessage = searchError instanceof Error ? searchError.message : "语义检索失败";
                errorType = "SEARCH_ERROR";
              }
              
              controller.enqueue(
                createSSEEvent("error", { message: errorMessage, errorType })
              );
              controller.close();
              return;
            }

            const sources = buildSources(searchResults);
            
            controller.enqueue(
              createSSEEvent("sources", { sources, searchTime })
            );

            try {
              console.log(`[RAG Chat] 开始流式 LLM，片段数: ${searchResults.length}`);

              const chatStream = await chatWithRAGStream(
                message,
                searchResults,
                { streaming: true },
                history
              );

              let fullContent = "";
              for await (const chunk of chatStream) {
                fullContent += chunk;
                controller.enqueue(
                  createSSEEvent("content", { content: chunk })
                );
              }

              console.log(`[RAG Chat] 流式 LLM 返回内容: ${fullContent.substring(0, 200)}${fullContent.length > 200 ? '...' : ''}`);

              const totalTime = Date.now() - startTime;
              controller.enqueue(
                createSSEEvent("done", { totalTime })
              );

              controller.close();
            } catch (llmError) {
              console.error("[RAG Chat] LLM 调用失败:", llmError);
              const errorMessage = llmError instanceof Error ? llmError.message : "LLM 服务调用失败";
              controller.enqueue(
                createSSEEvent("error", { message: errorMessage, errorType: "LLM_ERROR" })
              );
              controller.close();
            }
          } catch (error) {
            console.error("[RAG Chat] 流式输出错误:", error);
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            controller.enqueue(
              createSSEEvent("error", { message: errorMessage, errorType: "INTERNAL_ERROR" })
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
      let searchResults: SearchResult[] = [];
      let searchTime = 0;
      
      try {
        const effectiveMinSimilarity = Math.max(minSimilarity || 0.38, 0.1);
        const searchStartTime = Date.now();
        searchResults = await semanticSearch(message, {
          knowledgeBaseId: knowledgeBaseId || undefined,
          limit: Math.min(limit, 10),
          minSimilarity: effectiveMinSimilarity,
          userId: user.id,
        });
        searchTime = Date.now() - searchStartTime;

        const topSimilarity = searchResults.length > 0
          ? (Math.max(...searchResults.map(r => r.similarity)) * 100).toFixed(1)
          : "0";
        const resultDetails = searchResults.map((r, i) =>
          `  #${i + 1}: ${(r.similarity * 100).toFixed(1)}% - ${r.documentTitle}\n    内容: ${r.content.substring(0, 100)}...`
        ).join('\n');

        console.log(
          `[RAG Chat] 语义检索完成，找到 ${searchResults.length} 个相关片段，阈值 ${(effectiveMinSimilarity * 100).toFixed(0)}%，最高匹配 ${topSimilarity}%，耗时 ${searchTime}ms\n${resultDetails}`
        );
      } catch (searchError) {
        console.error("[RAG Chat] 语义检索失败:", searchError);
        
        let errorMessage: string;
        let status: number;
        
        if (searchError instanceof EmptyVectorStoreError) {
          errorMessage = searchError.message;
          status = 200;
          return NextResponse.json(
            { 
              message: errorMessage, 
              errorType: "EMPTY_VECTOR_STORE",
              answer: "",
              sources: [],
            },
            { status }
          );
        } else if (searchError instanceof EmbeddingTimeoutError) {
          errorMessage = searchError.message;
          status = 504;
        } else {
          errorMessage = searchError instanceof Error ? searchError.message : "语义检索失败";
          status = 500;
        }
        
        return NextResponse.json(
          { message: errorMessage, errorType: "SEARCH_ERROR" },
          { status }
        );
      }

      const sources = buildSources(searchResults);

      console.log(`[RAG Chat] 开始调用 LLM，片段数: ${searchResults.length}`);

      const answer = await chatWithRAG(
        message,
        searchResults,
        { streaming: false },
        history
      );

      console.log(`[RAG Chat] LLM 返回内容: ${answer.substring(0, 200)}${answer.length > 200 ? '...' : ''}`);

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
          { message: "未登录，请先登录", errorType: "UNAUTHORIZED" },
          { status: 401 }
        );
      }
      if (error.message === "账号待审核，请联系管理员" || 
          error.message === "账号已被禁用，请联系管理员") {
        return NextResponse.json(
          { message: error.message, errorType: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    console.error("[RAG Chat] 对话失败:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      { message: `对话失败: ${errorMessage}`, errorType: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
