import prisma from "@/lib/prisma";
import { splitSQLIntoChunks, splitTextIntoChunks } from "@/lib/documentChunkProcessor";
import { calculateChunkHash } from "@/lib/chunkHash";
import { embedDocuments } from "@/lib/embedding";
import { updateChunkEmbedding } from "@/lib/vectorStore";
import { isMilvusEnabled } from "@/lib/milvusConfig";

export enum FileStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  DONE = "DONE",
  FAILED = "FAILED",
}

export enum ChunkStatus {
  PENDING = "PENDING",
  EMBEDDING_DONE = "EMBEDDING_DONE",
  VECTOR_DONE = "VECTOR_DONE",
  FAILED = "FAILED",
}

export interface SingleFileRAGProgress {
  stage: "parsing" | "chunking" | "embedding" | "vector_insert" | "complete" | "failed";
  progress: number;
  message: string;
  processedChunks: number;
  totalChunks: number;
}

export type SingleFileRAGProgressCallback = (progress: SingleFileRAGProgress) => void;

const EMBEDDING_BATCH_SIZE = 10;

export async function processSingleFileRAG(
  documentId: string,
  fileContent: string,
  fileType: string,
  onProgress?: SingleFileRAGProgressCallback
): Promise<{
  success: boolean;
  totalChunks: number;
  newChunks: number;
  skippedChunks: number;
  failedChunks: number;
  error?: string;
}> {
  console.log(`[单文件RAG] 开始处理文档: ${documentId}`);
  console.log(`[单文件RAG] 文件类型: ${fileType}`);
  console.log(`[单文件RAG] 内容长度: ${fileContent.length}`);

  try {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: FileStatus.PROCESSING },
    });

    onProgress?.({
      stage: "parsing",
      progress: 10,
      message: "文档解析完成",
      processedChunks: 0,
      totalChunks: 0,
    });

    const chunks = fileType === "SQL" 
      ? splitSQLIntoChunks(fileContent)
      : splitTextIntoChunks(fileContent);

    console.log(`[单文件RAG] 生成 ${chunks.length} 个 chunks`);

    onProgress?.({
      stage: "chunking",
      progress: 20,
      message: `生成了 ${chunks.length} 个 chunks`,
      processedChunks: 0,
      totalChunks: chunks.length,
    });

    let newChunks = 0;
    let skippedChunks = 0;
    let failedChunks = 0;

    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const batchStart = i;
      const batchEnd = Math.min(i + EMBEDDING_BATCH_SIZE, chunks.length);
      const batchNumber = Math.floor(i / EMBEDDING_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE);

      console.log(`[单文件RAG] 处理批次 ${batchNumber}/${totalBatches} (chunks ${batchStart}-${batchEnd})`);

      onProgress?.({
        stage: "embedding",
        progress: 20 + Math.floor((batchEnd / chunks.length) * 60),
        message: `处理 chunks ${batchStart}-${batchEnd}`,
        processedChunks: batchEnd,
        totalChunks: chunks.length,
      });

      for (let j = 0; j < batchChunks.length; j++) {
        const chunkIndex = batchStart + j;
        const chunkContent = batchChunks[j];
        const chunkHash = calculateChunkHash(chunkContent);

        const existingChunk = await prisma.documentChunk.findFirst({
          where: {
            documentId,
            chunkHash,
          },
        });

        if (existingChunk?.embedding) {
          const useMilvus = await isMilvusEnabled();
          if (useMilvus) {
            const existsInMilvus = await checkMilvusVectorExistsByEmbedding(
              existingChunk.embedding,
              existingChunk.id
            );
            if (existsInMilvus) {
              console.log(`[单文件RAG] skip chunk ${chunkIndex}: embedding 和 Milvus 都已存在`);
              skippedChunks++;
              continue;
            } else {
              console.log(`[单文件RAG] chunk ${chunkIndex}: embedding 存在但 Milvus 不存在，需要重新插入`);
            }
          } else {
            console.log(`[单文件RAG] skip chunk ${chunkIndex}: embedding 已存在`);
            skippedChunks++;
            continue;
          }
        }

        try {
          let chunkId = existingChunk?.id;

          if (!existingChunk) {
            const created = await prisma.documentChunk.create({
              data: {
                documentId,
                index: chunkIndex,
                content: chunkContent,
                chunkHash,
                status: ChunkStatus.PENDING,
              },
            });
            chunkId = created.id;
            newChunks++;
          }

          if (!existingChunk?.embedding) {
            console.log(`[单文件RAG] 为 chunk ${chunkIndex} 生成 embedding`);

            const embeddingResult = await embedDocuments([chunkContent]);
            const vector = embeddingResult.vectors[0];

            if (!vector) {
              throw new Error("Embedding 返回向量为空");
            }

            await updateChunkEmbedding(chunkId!, vector, embeddingResult.model, {
              documentId,
              knowledgeBaseId: null,
              content: chunkContent,
              index: chunkIndex,
            });

            console.log(`[单文件RAG] chunk ${chunkIndex} embedding 完成`);
          }

          console.log(`[单文件RAG] chunk ${chunkIndex} 处理完成`);
        } catch (error) {
          console.error(`[单文件RAG] chunk ${chunkIndex} 处理失败:`, error);
          failedChunks++;

          if (existingChunk) {
            await prisma.documentChunk.update({
              where: { id: existingChunk.id },
              data: { status: ChunkStatus.FAILED },
            }).catch(() => {});
          }
        }
      }

      onProgress?.({
        stage: "vector_insert",
        progress: 20 + Math.floor((batchEnd / chunks.length) * 60),
        message: `批次 ${batchNumber}/${totalBatches} 完成`,
        processedChunks: batchEnd,
        totalChunks: chunks.length,
      });

      console.log(`[单文件RAG] 批次 ${batchNumber} 完成，释放内存`);
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { 
        status: failedChunks > 0 && newChunks === 0 
          ? FileStatus.FAILED 
          : FileStatus.DONE 
      },
    });

    onProgress?.({
      stage: "complete",
      progress: 100,
      message: `完成: 新建=${newChunks}, 跳过=${skippedChunks}, 失败=${failedChunks}`,
      processedChunks: chunks.length,
      totalChunks: chunks.length,
    });

    console.log(`[单文件RAG] 处理完成: 新建=${newChunks}, 跳过=${skippedChunks}, 失败=${failedChunks}`);

    return {
      success: true,
      totalChunks: chunks.length,
      newChunks,
      skippedChunks,
      failedChunks,
    };

  } catch (error) {
    console.error(`[单文件RAG] 处理失败:`, error);

    await prisma.document.update({
      where: { id: documentId },
      data: { status: FileStatus.FAILED },
    });

    onProgress?.({
      stage: "failed",
      progress: 0,
      message: `处理失败: ${error instanceof Error ? error.message : "未知错误"}`,
      processedChunks: 0,
      totalChunks: 0,
    });

    return {
      success: false,
      totalChunks: 0,
      newChunks: 0,
      skippedChunks: 0,
      failedChunks: 0,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

async function checkMilvusVectorExistsByEmbedding(
  embeddingJson: string,
  chunkId: string
): Promise<boolean> {
  try {
    const { searchMilvusVectors } = await import("@/lib/milvusClient");
    const vector = JSON.parse(embeddingJson);

    const results = await searchMilvusVectors(vector, {
      limit: 1,
      minSimilarity: 0.9999,
    });

    return results.some(r => r.chunkId === chunkId);
  } catch (error) {
    console.error(`[Milvus检查] 失败:`, error);
    return false;
  }
}

export async function resumeSingleFileRAG(
  documentId: string
): Promise<{
  success: boolean;
  processedChunks: number;
  error?: string;
}> {
  console.log(`[单文件RAG恢复] 开始恢复文档: ${documentId}`);

  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        chunks: {
          orderBy: { index: "asc" },
        },
      },
    });

    if (!document) {
      return { success: false, processedChunks: 0, error: "文档不存在" };
    }

    if (document.status === FileStatus.DONE) {
      console.log(`[单文件RAG恢复] 文档已完成，无需恢复`);
      return { success: true, processedChunks: document.chunks.length };
    }

    let processedChunks = 0;

    for (const chunk of document.chunks) {
      if (chunk.status === ChunkStatus.VECTOR_DONE) {
        continue;
      }

      if (chunk.embedding) {
        const useMilvus = await isMilvusEnabled();
        if (useMilvus) {
          const existsInMilvus = await checkMilvusVectorExistsByEmbedding(
            chunk.embedding,
            chunk.id
          );
          if (existsInMilvus) {
            await prisma.documentChunk.update({
              where: { id: chunk.id },
              data: { status: ChunkStatus.VECTOR_DONE },
            });
            processedChunks++;
            continue;
          }
        }
      }

      try {
        if (!chunk.embedding) {
          const embeddingResult = await embedDocuments([chunk.content]);
          const vector = embeddingResult.vectors[0];

          if (!vector) {
            throw new Error("Embedding 返回向量为空");
          }

          await updateChunkEmbedding(chunk.id, vector, embeddingResult.model, {
            documentId,
            knowledgeBaseId: document.knowledgeBaseId,
            content: chunk.content,
            index: chunk.index,
          });
        }

        await prisma.documentChunk.update({
          where: { id: chunk.id },
          data: { status: ChunkStatus.VECTOR_DONE },
        });
        processedChunks++;
      } catch (error) {
        console.error(`[单文件RAG恢复] chunk ${chunk.id} 恢复失败:`, error);
      }
    }

    const remainingChunks = await prisma.documentChunk.count({
      where: {
        documentId,
        status: { not: ChunkStatus.VECTOR_DONE }
      }
    });

    const allDone = remainingChunks === 0;

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: allDone ? FileStatus.DONE : FileStatus.PROCESSING
      },
    });

    console.log(`[单文件RAG恢复] 完成，恢复 ${processedChunks} 个 chunks，剩余未完成: ${remainingChunks}，文档状态: ${allDone ? 'DONE' : 'PROCESSING'}`);

    return { success: true, processedChunks };
  } catch (error) {
    console.error(`[单文件RAG恢复] 失败:`, error);
    return {
      success: false,
      processedChunks: 0,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}
