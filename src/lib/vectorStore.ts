import prisma from "@/lib/prisma";
import { embedQuery, serializeVector, sortBySimilarity, deserializeVector } from "@/lib/embedding";

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  knowledgeBaseId: string | null;
  knowledgeBaseName: string | null;
  content: string;
  similarity: number;
  index: number;
}

export interface SearchOptions {
  knowledgeBaseId?: string;
  limit?: number;
  minSimilarity?: number;
  userId?: string;
}

export class EmbeddingTimeoutError extends Error {
  constructor(message = "Embedding 服务超时") {
    super(message);
    this.name = "EmbeddingTimeoutError";
  }
}

export class EmptyVectorStoreError extends Error {
  constructor(message = "当前知识库中没有已向量化的文档") {
    super(message);
    this.name = "EmptyVectorStoreError";
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new EmbeddingTimeoutError(errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

export async function semanticSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    knowledgeBaseId,
    limit = 5,
    minSimilarity = 0.38,
    userId,
  } = options;

  let queryVector: number[];
  try {
    console.log(`[VectorSearch] 开始向量化查询: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    
    const queryEmbeddingResult = await withTimeout(
      embedQuery(query),
      30000,
      "Embedding 服务响应超时（30秒）"
    );
    
    queryVector = queryEmbeddingResult.vectors[0];
    
    if (!queryVector || queryVector.length === 0) {
      throw new Error("Embedding 服务返回空向量");
    }
    
    console.log(`[VectorSearch] 查询向量化完成，维度: ${queryVector.length}`);
  } catch (error) {
    if (error instanceof EmbeddingTimeoutError) {
      throw error;
    }
    console.error("[VectorSearch] 查询向量化失败:", error);
    throw new Error(`向量化失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }

  let chunks: Array<{
    id: string;
    documentId: string;
    index: number;
    content: string;
    embedding: string | null;
    document: {
      id: string;
      title: string;
      knowledgeBaseId: string | null;
      knowledgeBase: {
        id: string;
        name: string;
      } | null;
    };
  }> = [];

  try {
    chunks = await prisma.documentChunk.findMany({
      where: {
        embedding: {
          not: null,
        },
        document: {
          ...(knowledgeBaseId
            ? {
                knowledgeBaseId: knowledgeBaseId,
              }
            : {}),
          ...(userId
            ? {
                OR: [
                  { authorId: userId },
                  {
                    knowledgeBase: {
                      ownerId: userId,
                    },
                  },
                ],
              }
            : {}),
        },
      },
      select: {
        id: true,
        documentId: true,
        index: true,
        content: true,
        embedding: true,
        document: {
          select: {
            id: true,
            title: true,
            knowledgeBaseId: true,
            knowledgeBase: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    console.log(`[VectorSearch] 找到 ${chunks.length} 个带向量的切片`);

    if (chunks.length === 0) {
      if (knowledgeBaseId) {
        throw new EmptyVectorStoreError("当前选中的知识库中没有已向量化的文档，请先上传文档");
      } else {
        throw new EmptyVectorStoreError("您的知识库中没有已向量化的文档，请先上传文档");
      }
    }
  } catch (error) {
    if (error instanceof EmptyVectorStoreError) {
      throw error;
    }
    console.error("[VectorSearch] 数据库查询失败:", error);
    throw new Error(`检索数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }

  let sortedResults: Array<{
    item: typeof chunks[0];
    similarity: number;
  }>;

  try {
    sortedResults = sortBySimilarity(chunks, queryVector);
    console.log(`[VectorSearch] 相似度计算完成，共 ${sortedResults.length} 个有效结果`);
  } catch (error) {
    console.error("[VectorSearch] 相似度计算失败:", error);
    throw new Error(`相似度计算失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }

  console.log(`[VectorSearch] 各切片原始相似度得分（按相似度排序）：`);
  sortedResults.forEach((result, index) => {
    const simPercent = (result.similarity * 100).toFixed(2);
    const isFiltered = result.similarity < minSimilarity;
    console.log(
      `[VectorSearch]   #${index + 1}: 文档="${result.item.document.title}", 片段#${result.item.index + 1}, 相似度=${simPercent}%${isFiltered ? " [已过滤]" : ""}`
    );
  });

  const filteredResults = sortedResults.filter(
    (result) => result.similarity >= minSimilarity
  );

  console.log(
    `[VectorSearch] 过滤后剩余 ${filteredResults.length} 个结果（相似度 >= ${(minSimilarity * 100).toFixed(1)}%）`
  );

  const topResults = filteredResults.slice(0, limit);

  return topResults.map(({ item, similarity }) => ({
    chunkId: item.id,
    documentId: item.documentId,
    documentTitle: item.document.title,
    knowledgeBaseId: item.document.knowledgeBaseId,
    knowledgeBaseName: item.document.knowledgeBase?.name || null,
    content: item.content,
    similarity,
    index: item.index,
  }));
}

export async function checkEmbeddingExists(chunkId: string): Promise<boolean> {
  const chunk = await prisma.documentChunk.findUnique({
    where: { id: chunkId },
    select: { embedding: true },
  });
  return chunk?.embedding != null;
}

export async function getChunksForDocument(documentId: string): Promise<Array<{
  id: string;
  index: number;
  content: string;
  hasEmbedding: boolean;
}>> {
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: {
      id: true,
      index: true,
      content: true,
      embedding: true,
    },
    orderBy: { index: "asc" },
  });

  return chunks.map((chunk) => ({
    id: chunk.id,
    index: chunk.index,
    content: chunk.content,
    hasEmbedding: chunk.embedding != null,
  }));
}

export async function updateChunkEmbedding(
  chunkId: string,
  vector: number[],
  model: string
): Promise<void> {
  await prisma.documentChunk.update({
    where: { id: chunkId },
    data: {
      embedding: serializeVector(vector),
      embeddingModel: model,
      updatedAt: new Date(),
    },
  });
}

export async function getEmbeddingStats(userId?: string): Promise<{
  totalChunks: number;
  embeddedChunks: number;
  pendingChunks: number;
}> {
  const whereClause = userId
    ? {
        document: {
          OR: [
            { authorId: userId },
            {
              knowledgeBase: {
                ownerId: userId,
              },
            },
          ],
        },
      }
    : {};

  const totalChunks = await prisma.documentChunk.count({ where: whereClause });

  const embeddedChunks = await prisma.documentChunk.count({
    where: {
      ...whereClause,
      embedding: {
        not: null,
      },
    },
  });

  return {
    totalChunks,
    embeddedChunks,
    pendingChunks: totalChunks - embeddedChunks,
  };
}
