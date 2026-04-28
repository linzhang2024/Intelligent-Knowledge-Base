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

export async function semanticSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    knowledgeBaseId,
    limit = 5,
    minSimilarity = 0.5,
    userId,
  } = options;

  const queryEmbeddingResult = await embedQuery(query);
  const queryVector = queryEmbeddingResult.vectors[0];

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

  const sortedResults = sortBySimilarity(chunks, queryVector);

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
