import { createHash } from "crypto";

export enum ChunkStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  DONE = "DONE",
  FAILED = "FAILED",
}

export enum VectorStatus {
  PENDING = "PENDING",
  EMBEDDING_DONE = "EMBEDDING_DONE",
  VECTOR_INSERTED = "VECTOR_INSERTED",
  FAILED = "FAILED",
}

export function calculateChunkHash(content: string): string {
  const hash = createHash("sha256");
  hash.update(content.trim());
  return hash.digest("hex");
}

export function calculateChunkHashWithIndex(content: string, documentId: string, index: number): string {
  const hash = createHash("sha256");
  hash.update(`${documentId}:${index}:${content.trim()}`);
  return hash.digest("hex");
}

export interface ChunkCheckResult {
  id: string;
  status: string;
  vectorStatus: string;
  embedding: string | null;
  embeddingModel: string | null;
  content: string;
}

export async function findExistingChunkByIndex(
  prisma: any,
  documentId: string,
  index: number
): Promise<ChunkCheckResult | null> {
  const existingChunk = await prisma.documentChunk.findUnique({
    where: {
      documentId_index: {
        documentId,
        index,
      },
    },
    select: {
      id: true,
      status: true,
      vectorStatus: true,
      embedding: true,
      embeddingModel: true,
      content: true,
    },
  });

  return existingChunk;
}

export async function checkMilvusVectorExists(
  chunkId: string,
  embeddingData?: string | null
): Promise<boolean> {
  try {
    const { isMilvusEnabled } = await import("@/lib/milvusConfig");
    const useMilvus = await isMilvusEnabled();
    
    if (!useMilvus) {
      console.log(`[Milvus 检查] chunkId=${chunkId}, 不使用 Milvus，假设向量已存在`);
      return true;
    }

    if (!embeddingData) {
      console.log(`[Milvus 检查] chunkId=${chunkId}, embedding 不存在，返回 false`);
      return false;
    }

    const { searchMilvusVectors } = await import("@/lib/milvusClient");
    
    const testVector = JSON.parse(embeddingData);
    const milvusResults = await searchMilvusVectors(testVector, {
      limit: 1,
      minSimilarity: 0.9999,
    });

    const exists = milvusResults.some(r => r.chunkId === chunkId);
    
    console.log(`[Milvus 检查] chunkId=${chunkId}, exists=${exists}`);
    
    return exists;
  } catch (error) {
    console.error(`[Milvus 检查] 失败:`, error);
    return false;
  }
}

export function getChunkProcessingState(
  existingChunk: ChunkCheckResult | null,
  milvusExists: boolean
): {
  shouldSkip: boolean;
  shouldRetry: boolean;
  needsEmbedding: boolean;
  needsMilvusInsert: boolean;
  reason: string;
} {
  if (!existingChunk) {
    return {
      shouldSkip: false,
      shouldRetry: false,
      needsEmbedding: true,
      needsMilvusInsert: true,
      reason: "新建 chunk",
    };
  }

  const chunkExists = true;
  const embeddingExists = existingChunk.embedding != null && existingChunk.embedding.length > 0;
  const vectorInserted = milvusExists;

  if (chunkExists && embeddingExists && vectorInserted) {
    return {
      shouldSkip: true,
      shouldRetry: false,
      needsEmbedding: false,
      needsMilvusInsert: false,
      reason: "chunk/embedding/vector 均已完成",
    };
  }

  const needsEmbedding = !embeddingExists;
  const needsMilvusInsert = embeddingExists && !vectorInserted;

  let reason = "";
  if (needsEmbedding) {
    reason = "需要 embedding";
  } else if (needsMilvusInsert) {
    reason = "embedding 存在但 Milvus 不存在，需要重新插入向量";
    if (existingChunk.vectorStatus === VectorStatus.VECTOR_INSERTED) {
      reason += " (注意：vectorStatus 标记与实际状态不一致)";
    }
  } else {
    reason = "需要重新处理";
  }

  return {
    shouldSkip: false,
    shouldRetry: true,
    needsEmbedding,
    needsMilvusInsert,
    reason,
  };
}
