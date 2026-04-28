import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { semanticSearch, SearchResult } from "@/lib/vectorStore";
import { isEmbeddingConfigured } from "@/lib/embedding";

export interface SearchRequest {
  query: string;
  knowledgeBaseId?: string;
  limit?: number;
  minSimilarity?: number;
}

export interface SearchResponse {
  query: string;
  totalMatched: number;
  results: SearchResult[];
  searchTime?: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    if (!isEmbeddingConfigured()) {
      return NextResponse.json(
        { message: "Embedding 服务未配置，无法进行语义搜索" },
        { status: 503 }
      );
    }

    const body: SearchRequest = await request.json();
    const { query, knowledgeBaseId, limit = 5, minSimilarity = 0.5 } = body;

    if (!query || query.trim() === "") {
      return NextResponse.json(
        { message: "query 参数不能为空" },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    const results = await semanticSearch(query, {
      knowledgeBaseId: knowledgeBaseId || undefined,
      limit: Math.min(limit, 10),
      minSimilarity: Math.max(minSimilarity, 0.1),
      userId: user.id,
    });

    const searchTime = Date.now() - startTime;

    console.log(
      `[SemanticSearch] 用户 "${user.id}" 搜索 "${query}"，找到 ${results.length} 个结果，耗时 ${searchTime}ms`
    );

    const response: SearchResponse = {
      query,
      totalMatched: results.length,
      results,
      searchTime,
    };

    return NextResponse.json(response, { status: 200 });
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

    console.error("语义搜索失败:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      { message: `搜索失败: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    if (!isEmbeddingConfigured()) {
      return NextResponse.json(
        { message: "Embedding 服务未配置，无法进行语义搜索" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const knowledgeBaseId = searchParams.get("knowledgeBaseId") || undefined;
    const limitParam = searchParams.get("limit");
    const minSimilarityParam = searchParams.get("minSimilarity");

    if (!query || query.trim() === "") {
      return NextResponse.json(
        { message: "query 参数不能为空" },
        { status: 400 }
      );
    }

    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 10) : 5;
    const minSimilarity = minSimilarityParam
      ? Math.max(parseFloat(minSimilarityParam), 0.1)
      : 0.5;

    const startTime = Date.now();

    const results = await semanticSearch(query, {
      knowledgeBaseId,
      limit,
      minSimilarity,
      userId: user.id,
    });

    const searchTime = Date.now() - startTime;

    console.log(
      `[SemanticSearch] 用户 "${user.id}" 搜索 "${query}"，找到 ${results.length} 个结果，耗时 ${searchTime}ms`
    );

    const response: SearchResponse = {
      query,
      totalMatched: results.length,
      results,
      searchTime,
    };

    return NextResponse.json(response, { status: 200 });
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

    console.error("语义搜索失败:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      { message: `搜索失败: ${errorMessage}` },
      { status: 500 }
    );
  }
}
