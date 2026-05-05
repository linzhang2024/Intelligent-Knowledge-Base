import prisma from "@/lib/prisma";
import { serializeVector, deserializeVector, sortBySimilarity } from "@/lib/embedding";
import { SearchResult, SearchOptions } from "@/lib/vectorStore";
import { VectorStoreBackend } from "@/lib/vectorStoreAbstract";

export class DatabaseVectorStore implements VectorStoreBackend {
  name = "database";

  async semanticSearch(
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

    console.log(`[DatabaseVectorStore] 找到 ${chunks.length} 个带向量的切片`);

    if (chunks.length === 0) {
      return [];
    }

    const sortedResults = sortBySimilarity(chunks, queryVector);

    console.log(`[DatabaseVectorStore] 相似度计算完成，共 ${sortedResults.length} 个有效结果`);

    const filteredResults = sortedResults.filter(
      (result) => result.similarity >= minSimilarity
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

  async updateChunkEmbedding(
    chunkId: string,
    vector: number[],
    model: string,
    metadata?: {
      documentId: string;
      knowledgeBaseId: string | null;
      content: string;
      index: number;
    }
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

  async checkEmbeddingExists(chunkId: string): Promise<boolean> {
    const chunk = await prisma.documentChunk.findUnique({
      where: { id: chunkId },
      select: { embedding: true },
    });
    return chunk?.embedding != null;
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    // 数据库中会通过级联删除自动处理
  }

  async deleteByChunkIds(chunkIds: string[]): Promise<void> {
    // 数据库中会通过级联删除自动处理
  }

  async getStats(userId?: string): Promise<{
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

  async getChunksForDocument(documentId: string): Promise<Array<{
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
}
