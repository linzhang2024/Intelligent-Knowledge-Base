import prisma from "@/lib/prisma";
import { embedQuery, serializeVector, sortBySimilarity, deserializeVector } from "@/lib/embedding";
import { isMilvusEnabled } from "@/lib/milvusConfig";
import {
  searchMilvusVectors,
  insertMilvusVectors,
  deleteMilvusVectorsByDocumentId,
  getMilvusStats,
} from "@/lib/milvusClient";

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

export interface ChunkMetadata {
  documentId: string;
  knowledgeBaseId: string | null;
  content: string;
  index: number;
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

async function semanticSearchDatabase(
  queryVector: number[],
  options: SearchOptions
): Promise<SearchResult[]> {
  const {
    knowledgeBaseId,
    limit = 5,
    minSimilarity = 0.38,
    userId,
  } = options;

  const chunks = await prisma.documentChunk.findMany({
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

  const sortedResults = sortBySimilarity(chunks, queryVector);
  console.log(`[VectorSearch] 相似度计算完成，共 ${sortedResults.length} 个有效结果`);

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

async function semanticSearchMilvus(
  queryVector: number[],
  options: SearchOptions
): Promise<SearchResult[]> {
  const {
    knowledgeBaseId,
    limit = 5,
    minSimilarity = 0.38,
    userId,
  } = options;

  const milvusResults = await searchMilvusVectors(queryVector, {
    limit: limit * 3,
    minSimilarity: minSimilarity,
    knowledgeBaseId,
  });

  console.log(`[VectorSearch] Milvus 返回 ${milvusResults.length} 个结果`);

  if (milvusResults.length === 0) {
    if (knowledgeBaseId) {
      throw new EmptyVectorStoreError("当前选中的知识库中没有已向量化的文档，请先上传文档");
    } else {
      throw new EmptyVectorStoreError("您的知识库中没有已向量化的文档，请先上传文档");
    }
  }

  const documentIds = [...new Set(milvusResults.map((r) => r.documentId))];

  const documents = await prisma.document.findMany({
    where: {
      id: { in: documentIds },
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
  });

  const docMap = new Map(documents.map((d) => [d.id, d]));

  const chunks = await prisma.documentChunk.findMany({
    where: {
      id: { in: milvusResults.map((r) => r.chunkId) },
    },
    select: {
      id: true,
      index: true,
    },
  });

  const chunkIndexMap = new Map(chunks.map((c) => [c.id, c.index]));

  const results: SearchResult[] = [];

  for (const mr of milvusResults) {
    const doc = docMap.get(mr.documentId);
    if (!doc) continue;

    results.push({
      chunkId: mr.chunkId,
      documentId: mr.documentId,
      documentTitle: doc.title,
      knowledgeBaseId: doc.knowledgeBaseId,
      knowledgeBaseName: doc.knowledgeBase?.name || null,
      content: mr.content,
      similarity: mr.similarity,
      index: chunkIndexMap.get(mr.chunkId) ?? 0,
    });

    if (results.length >= limit) break;
  }

  console.log(`[VectorSearch] 过滤后剩余 ${results.length} 个结果（权限过滤后）`);

  return results;
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

  const useMilvus = await isMilvusEnabled();
  console.log(`[VectorSearch] 使用存储后端: ${useMilvus ? "Milvus" : "Database"}`);

  if (useMilvus) {
    return semanticSearchMilvus(queryVector, {
      knowledgeBaseId,
      limit,
      minSimilarity,
      userId,
    });
  }

  return semanticSearchDatabase(queryVector, {
    knowledgeBaseId,
    limit,
    minSimilarity,
    userId,
  });
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
  model: string,
  metadata?: ChunkMetadata
): Promise<void> {
  await prisma.documentChunk.update({
    where: { id: chunkId },
    data: {
      embedding: serializeVector(vector),
      embeddingModel: model,
      updatedAt: new Date(),
    },
  });

  const useMilvus = await isMilvusEnabled();
  
  if (useMilvus && metadata) {
    console.log(`[VectorStore] 更新 Milvus 向量: ${chunkId}`);
    
    const result = await insertMilvusVectors([
      {
        id: chunkId,
        chunkId: chunkId,
        documentId: metadata.documentId,
        knowledgeBaseId: metadata.knowledgeBaseId,
        content: metadata.content,
        embedding: vector,
        model: model,
      },
    ]);

    if (!result.success) {
      console.error(`[VectorStore] Milvus 向量插入失败: ${result.message}`);
    }
  }
}

export async function deleteEmbeddingsByDocumentId(documentId: string): Promise<void> {
  const useMilvus = await isMilvusEnabled();
  
  if (useMilvus) {
    console.log(`[VectorStore] 删除 Milvus 向量，文档ID: ${documentId}`);
    await deleteMilvusVectorsByDocumentId(documentId);
  }
}

export async function getEmbeddingStats(userId?: string): Promise<{
  totalChunks: number;
  embeddedChunks: number;
  pendingChunks: number;
  backend: string;
}> {
  const useMilvus = await isMilvusEnabled();

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

  let embeddedChunks: number;
  
  if (useMilvus) {
    const milvusStats = await getMilvusStats();
    embeddedChunks = milvusStats.totalVectors;
  } else {
    embeddedChunks = await prisma.documentChunk.count({
      where: {
        ...whereClause,
        embedding: {
          not: null,
        },
      },
    });
  }

  return {
    totalChunks,
    embeddedChunks,
    pendingChunks: totalChunks - embeddedChunks,
    backend: useMilvus ? "milvus" : "database",
  };
}

export { isMilvusEnabled };
