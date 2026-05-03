import prisma from "@/lib/prisma";
import { sanitizeAndSplitChunks } from "@/lib/textSanitizer";

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const MAX_SINGLE_CHUNK_SIZE = 2000;
const BATCH_SIZE = 200;

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
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
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

export async function processChunksWithErrorHandling(
  chunks: string[],
  documentId: string,
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
    CHUNK_SIZE,
    MAX_SINGLE_CHUNK_SIZE
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

export { CHUNK_SIZE, CHUNK_OVERLAP, MAX_SINGLE_CHUNK_SIZE, BATCH_SIZE };
