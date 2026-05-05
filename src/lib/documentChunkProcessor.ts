import prisma from "@/lib/prisma";
import { sanitizeAndSplitChunks } from "@/lib/textSanitizer";
import { getRAGConfig, DEFAULT_RAG_CONFIG, DEFAULT_SQL_RAG_CONFIG, RAGConfig } from "@/lib/ragConfig";

const BATCH_SIZE = 200;

let cachedRAGConfig: RAGConfig | null = null;
let cachedConfigTime = 0;
const CACHE_TTL = 60000;

async function getCachedRAGConfig(): Promise<RAGConfig> {
  const now = Date.now();
  if (cachedRAGConfig && now - cachedConfigTime < CACHE_TTL) {
    return cachedRAGConfig;
  }
  
  try {
    cachedRAGConfig = await getRAGConfig();
    cachedConfigTime = now;
    return cachedRAGConfig;
  } catch (error) {
    console.warn("[RAG Config] 读取配置失败，使用默认值:", error);
    return {
      chunkSize: DEFAULT_RAG_CONFIG.chunkSize,
      chunkOverlap: DEFAULT_RAG_CONFIG.chunkOverlap,
      maxSingleChunkSize: DEFAULT_RAG_CONFIG.maxSingleChunkSize,
      sqlChunkSize: DEFAULT_SQL_RAG_CONFIG.chunkSize,
      sqlChunkOverlap: DEFAULT_SQL_RAG_CONFIG.chunkOverlap,
      sqlMaxSingleChunkSize: DEFAULT_SQL_RAG_CONFIG.maxSingleChunkSize,
    };
  }
}

export interface ChunkProcessingProgress {
  stage: "preparing" | "sanitizing" | "storing" | "complete";
  progress: number;
  processedItems: number;
  totalItems: number;
  message: string;
}

export interface ChunkProcessingResult {
  storedCount: number;
  skippedCount: number;
  sanitizationErrors: number;
}

export type ChunkProgressCallback = (progress: ChunkProcessingProgress) => void;

export function splitTextIntoChunks(
  text: string,
  chunkSize: number = DEFAULT_RAG_CONFIG.chunkSize,
  overlap: number = DEFAULT_RAG_CONFIG.chunkOverlap
): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  const sentences = text.split(/([。！？.!?\n])/).filter((s) => s.trim());

  let currentChunk = "";

  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] + (sentences[i + 1] || "");

    if (
      currentChunk.length + sentence.length > chunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());

      if (overlap > 0 && currentChunk.length > overlap) {
        const lastPart = currentChunk.slice(-overlap);
        const lastSentenceMatch = lastPart.match(
          /[^。！？.!?\n]*[。！？.!?\n]?$/
        );
        currentChunk = lastSentenceMatch ? lastSentenceMatch[0] : lastPart;
      } else {
        currentChunk = "";
      }
    }

    currentChunk += sentence;
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export function splitSQLIntoChunks(text: string): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  const pattern =
    /(CREATE\s+(OR\s+REPLACE\s+)?(TABLE|FUNCTION|PROCEDURE|PACKAGE|VIEW|INDEX|TRIGGER|SYNONYM|SEQUENCE|TYPE|CONTEXT|DIRECTORY|JAVA))/gi;
  const positions: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    positions.push(match.index);
  }

  if (positions.length === 0) {
    return [text];
  }

  const chunks: string[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = positions[i + 1] || text.length;
    const chunk = text.substring(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

async function processChunksWithErrorHandlingInternal(
  chunks: string[],
  documentId: string,
  chunkSize: number,
  maxSingleChunkSize: number,
  onProgress?: ChunkProgressCallback
): Promise<ChunkProcessingResult> {
  if (onProgress) {
    onProgress({
      stage: "preparing",
      progress: 0,
      processedItems: 0,
      totalItems: chunks.length,
      message: "正在准备文本片段...",
    });
  }

  const sanitizeResult = sanitizeAndSplitChunks(
    chunks,
    chunkSize,
    maxSingleChunkSize
  );

  if (onProgress) {
    onProgress({
      stage: "sanitizing",
      progress: 10,
      processedItems: 0,
      totalItems: sanitizeResult.chunks.length,
      message: "正在清洗文本片段...",
    });
  }

  const processedChunks = sanitizeResult.chunks;
  let storedCount = 0;
  const skippedIndices: number[] = [];
  const totalBatches = Math.ceil(processedChunks.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, processedChunks.length);
    const batchChunks = processedChunks.slice(start, end);

    const batchData = batchChunks.map((chunk, i) => ({
      documentId,
      index: start + i,
      content: chunk,
    }));

    try {
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < batchData.length; i++) {
          try {
            await tx.documentChunk.create({
              data: batchData[i],
            });
            storedCount++;
          } catch (error) {
            console.error(
              `[RAG 存储] 片段 ${start + i} 存储失败，跳过:`,
              error instanceof Error ? error.message : "未知错误"
            );
            skippedIndices.push(start + i);
          }
        }
      });
    } catch (error) {
      console.error(
        `[RAG 存储] 批次 ${batchIndex + 1} 事务失败，逐个重试:`,
        error instanceof Error ? error.message : "未知错误"
      );
      
      for (let i = 0; i < batchData.length; i++) {
        try {
          await prisma.documentChunk.create({
            data: batchData[i],
          });
          storedCount++;
        } catch (error) {
          console.error(
            `[RAG 存储] 片段 ${start + i} 存储失败，跳过:`,
            error instanceof Error ? error.message : "未知错误"
          );
          skippedIndices.push(start + i);
        }
      }
    }

    if (onProgress) {
      const currentProgress = 10 + ((end / processedChunks.length) * 90);
      onProgress({
        stage: "storing",
        progress: currentProgress,
        processedItems: end,
        totalItems: processedChunks.length,
        message: `正在将片段批量写入数据库 (${end}/${processedChunks.length})...`,
      });
    }
  }

  if (sanitizeResult.skippedChunks.length > 0) {
    console.warn(
      `[RAG 存储] 原始 ${sanitizeResult.skippedChunks.length} 个片段因清洗失败被跳过`
    );
  }

  if (skippedIndices.length > 0) {
    console.warn(
      `[RAG 存储] ${skippedIndices.length} 个片段因数据库写入失败被跳过`
    );
  }

  if (onProgress) {
    onProgress({
      stage: "complete",
      progress: 100,
      processedItems: storedCount,
      totalItems: processedChunks.length,
      message: `片段存储完成: 成功 ${storedCount} 个`,
    });
  }

  return {
    storedCount,
    skippedCount: sanitizeResult.skippedChunks.length + skippedIndices.length,
    sanitizationErrors: sanitizeResult.sanitizationErrors,
  };
}

export async function processChunksWithErrorHandling(
  chunks: string[],
  documentId: string,
  onProgress?: ChunkProgressCallback
): Promise<ChunkProcessingResult> {
  const config = await getCachedRAGConfig();
  return processChunksWithErrorHandlingInternal(
    chunks,
    documentId,
    config.chunkSize,
    config.maxSingleChunkSize,
    onProgress
  );
}

export async function processSQLChunksWithErrorHandling(
  chunks: string[],
  documentId: string,
  onProgress?: ChunkProgressCallback
): Promise<ChunkProcessingResult> {
  const config = await getCachedRAGConfig();
  return processChunksWithErrorHandlingInternal(
    chunks,
    documentId,
    config.sqlChunkSize,
    config.sqlMaxSingleChunkSize,
    onProgress
  );
}

export { BATCH_SIZE, DEFAULT_RAG_CONFIG, DEFAULT_SQL_RAG_CONFIG };
