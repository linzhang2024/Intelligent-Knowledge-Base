import prisma from "@/lib/prisma";
import { SearchResult, SearchOptions } from "@/lib/vectorStore";
import { VectorStoreBackend } from "@/lib/vectorStoreAbstract";
import {
  searchMilvusVectors,
  insertMilvusVectors,
  deleteMilvusVectors,
  deleteMilvusVectorsByDocumentId,
  getMilvusStats,
} from "@/lib/milvusClient";

export class MilvusVectorStore implements VectorStoreBackend {
  name = "milvus";

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

    if (userId) {
      const milvusResults = await searchMilvusVectors(queryVector, {
        limit: limit * 3,
        minSimilarity: minSimilarity,
        knowledgeBaseId,
      });

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

      return results;
    }

    const milvusResults = await searchMilvusVectors(queryVector, {
      limit,
      minSimilarity,
      knowledgeBaseId,
    });

    const documentIds = [...new Set(milvusResults.map((r) => r.documentId))];
    const chunkIds = milvusResults.map((r) => r.chunkId);

    const [documents, chunks] = await Promise.all([
      prisma.document.findMany({
        where: { id: { in: documentIds } },
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
      }),
      prisma.documentChunk.findMany({
        where: { id: { in: chunkIds } },
        select: {
          id: true,
          index: true,
        },
      }),
    ]);

    const docMap = new Map(documents.map((d) => [d.id, d]));
    const chunkIndexMap = new Map(chunks.map((c) => [c.id, c.index]));

    return milvusResults.map((mr) => {
      const doc = docMap.get(mr.documentId);
      return {
        chunkId: mr.chunkId,
        documentId: mr.documentId,
        documentTitle: doc?.title || "Unknown",
        knowledgeBaseId: doc?.knowledgeBaseId ?? null,
        knowledgeBaseName: doc?.knowledgeBase?.name ?? null,
        content: mr.content,
        similarity: mr.similarity,
        index: chunkIndexMap.get(mr.chunkId) ?? 0,
      };
    });
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
    if (!metadata) {
      throw new Error("MilvusVectorStore 需要 metadata 参数");
    }

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
      throw new Error(result.message);
    }
  }

  async checkEmbeddingExists(chunkId: string): Promise<boolean> {
    const dbChunk = await prisma.documentChunk.findUnique({
      where: { id: chunkId },
      select: { embedding: true },
    });
    return dbChunk?.embedding != null;
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await deleteMilvusVectorsByDocumentId(documentId);
  }

  async deleteByChunkIds(chunkIds: string[]): Promise<void> {
    await deleteMilvusVectors(chunkIds);
  }

  async getStats(userId?: string): Promise<{
    totalChunks: number;
    embeddedChunks: number;
    pendingChunks: number;
  }> {
    const milvusStats = await getMilvusStats();

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

    return {
      totalChunks,
      embeddedChunks: milvusStats.totalVectors,
      pendingChunks: totalChunks - milvusStats.totalVectors,
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
