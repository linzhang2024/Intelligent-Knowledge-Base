import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { embedDocuments, isEmbeddingConfigured, serializeVector } from "@/lib/embedding";
import {
  parseDocument,
  DocumentParseError,
  EncryptedPDFError,
  ScannedPDFError,
  CorruptedFileError,
  UnsupportedFormatError,
  EmptyContentError,
  getDocumentTypeFromExtension,
  DocumentType,
} from "@/lib/documentParser";
import { sanitizeAndSplitChunks } from "@/lib/textSanitizer";

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const MAX_SINGLE_CHUNK_SIZE = 2000;

function splitTextIntoChunks(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  const sentences = text.split(/([。！？.!?\n])/).filter(s => s.trim());
  
  let currentChunk = "";
  
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] + (sentences[i + 1] || "");
    
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      if (overlap > 0 && currentChunk.length > overlap) {
        const lastPart = currentChunk.slice(-overlap);
        const lastSentenceMatch = lastPart.match(/[^。！？.!?\n]*[。！？.!?\n]?$/);
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const documentId = params.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId, deletedAt: null },
      include: {
        chunks: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { message: "文档不存在或已被删除" },
        { status: 404 }
      );
    }

    if (!document.fileUrl) {
      return NextResponse.json(
        { message: "该文档没有关联的文件，无法重新解析" },
        { status: 400 }
      );
    }

    const filePath = path.join(process.cwd(), document.fileUrl);
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { message: "文件不存在，无法重新解析" },
        { status: 400 }
      );
    }

    const fileExtension = "." + (document.fileType?.toLowerCase() || "");
    let extractedContent = document.content || "";
    let parseError: DocumentParseError | null = null;
    let textChunks: string[] = [];
    let docType: DocumentType | null = null;

    try {
      docType = getDocumentTypeFromExtension(fileExtension);
      console.log(`[重新解析] 开始解析文档: ${document.title}, 类型: ${docType}`);
      
      const parseResult = await parseDocument(filePath, docType);
      extractedContent = parseResult.text;
      
      console.log(`[重新解析] 文档解析成功，文本长度: ${extractedContent.length} 字符`);
    } catch (error) {
      if (error instanceof DocumentParseError) {
        parseError = error;
        console.log("[重新解析] 文档解析失败:", error.message);
      } else {
        throw error;
      }
    }

    if (parseError) {
      return NextResponse.json(
        { 
          message: parseError.message,
          errorType: parseError.name
        },
        { status: 500 }
      );
    }

    textChunks = splitTextIntoChunks(extractedContent);
    console.log(`[重新解析] 文档 "${document.title}" 文本长度: ${extractedContent.length} 字符`);
    console.log(`[重新解析] 文档 "${document.title}" 切片数量: ${textChunks.length} 个片段`);
    
    if (textChunks.length === 0) {
      console.log(`[重新解析] 文档 "${document.title}" 切片数量为0`);
      return NextResponse.json(
        { message: "文档内容为空，无法生成切片" },
        { status: 400 }
      );
    }

    const embeddingConfigured = await isEmbeddingConfigured();

    const result = await prisma.$transaction(async (tx) => {
      const oldChunkCount = document.chunks.length;
      if (oldChunkCount > 0) {
        await tx.documentChunk.deleteMany({
          where: { documentId },
        });
        console.log(`[重新解析] 已删除文档 "${document.title}" 的 ${oldChunkCount} 个旧切片`);
      }

      const sanitizeResult = sanitizeAndSplitChunks(
        textChunks,
        CHUNK_SIZE,
        MAX_SINGLE_CHUNK_SIZE
      );

      const processedChunks = sanitizeResult.chunks;
      let storedCount = 0;
      const skippedIndices: number[] = [];

      for (let i = 0; i < processedChunks.length; i++) {
        const chunk = processedChunks[i];
        const chunkData = {
          documentId,
          index: i,
          content: chunk,
        };

        try {
          await tx.documentChunk.create({
            data: chunkData,
          });
          storedCount++;
        } catch (error) {
          console.error(
            `[重新解析] 片段 ${i} 存储失败，跳过:`,
            error instanceof Error ? error.message : "未知错误"
          );
          skippedIndices.push(i);
        }
      }

      if (sanitizeResult.skippedChunks.length > 0) {
        console.warn(
          `[重新解析] 原始 ${sanitizeResult.skippedChunks.length} 个片段因清洗失败被跳过`
        );
      }

      if (skippedIndices.length > 0) {
        console.warn(
          `[重新解析] ${skippedIndices.length} 个片段因数据库写入失败被跳过`
        );
      }

      await tx.document.update({
        where: { id: documentId },
        data: {
          content: extractedContent,
          updatedAt: new Date(),
        },
      });

      return {
        storedCount,
        skippedCount: sanitizeResult.skippedChunks.length + skippedIndices.length,
        sanitizationErrors: sanitizeResult.sanitizationErrors,
      };
    });

    let embeddingSuccess = false;
    let embeddingError: string | null = null;

    if (embeddingConfigured && result.storedCount > 0) {
      try {
        console.log(`[重新解析] 开始向量化文档 "${document.title}" 的 ${result.storedCount} 个片段`);
        
        const chunks = await prisma.documentChunk.findMany({
          where: { documentId },
          orderBy: { index: "asc" },
          select: { id: true, content: true, index: true },
        });

        const validChunks = chunks.filter(c => c.content && c.content.trim().length > 0);
        const contents = validChunks.map(c => c.content || "");

        if (contents.length > 0) {
          const batchSize = 10;
          for (let batch = 0; batch < contents.length; batch += batchSize) {
            const batchContents = contents.slice(batch, batch + batchSize);
            const batchChunks = validChunks.slice(batch, batch + batchSize);

            try {
              const embeddingResult = await embedDocuments(batchContents);
              console.log(
                `[重新解析] 批次 ${Math.floor(batch / batchSize) + 1}/${Math.ceil(contents.length / batchSize)} 向量化完成，模型: ${embeddingResult.model}`
              );

              for (let i = 0; i < batchChunks.length && i < embeddingResult.vectors.length; i++) {
                try {
                  await prisma.documentChunk.update({
                    where: { id: batchChunks[i].id },
                    data: {
                      embedding: serializeVector(embeddingResult.vectors[i]),
                      embeddingModel: embeddingResult.model,
                      updatedAt: new Date(),
                    },
                  });
                } catch (updateError) {
                  console.error(
                    `[重新解析] 片段 ${batchChunks[i].index} 向量存储失败，跳过:`,
                    updateError instanceof Error ? updateError.message : "未知错误"
                  );
                }
              }
            } catch (batchError) {
              console.error(
                `[重新解析] 批次 ${Math.floor(batch / batchSize) + 1} 向量化失败，跳过该批次:`,
                batchError instanceof Error ? batchError.message : "未知错误"
              );
            }
          }
        }

        embeddingSuccess = true;
        console.log(`[重新解析] 文档 "${document.title}" 向量化存储完成`);
      } catch (error) {
        embeddingError = error instanceof Error ? error.message : "未知错误";
        console.error(`[重新解析] 向量化失败:`, error);
      }
    } else {
      if (!embeddingConfigured) {
        console.log(`[重新解析] Embedding 服务未配置，跳过向量化`);
      }
      if (result.storedCount === 0) {
        console.log(`[重新解析] 没有有效片段，跳过向量化`);
      }
    }

    return NextResponse.json(
      {
        message: result.skippedCount > 0 
          ? `重新解析成功（跳过 ${result.skippedCount} 个问题片段）`
          : "重新解析成功",
        document: {
          ...document,
          fileSize: document.fileSize?.toString() || null,
          content: extractedContent,
        },
        rag: {
          chunkCount: result.storedCount,
          skippedCount: result.skippedCount,
          sanitizationErrors: result.sanitizationErrors,
          embeddingConfigured,
          embeddingSuccess,
          embeddingError,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    if (error instanceof DocumentParseError) {
      return NextResponse.json(
        { 
          message: error.message,
          errorType: error.name
        },
        { status: 400 }
      );
    }
    
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { message: "未登录，请先登录" },
          { status: 401 }
        );
      }
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { message: "无权限访问此资源" },
          { status: 403 }
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
    
    console.error("文档重新解析失败:", error);
    
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    
    return NextResponse.json(
      { 
        message: `重新解析失败: ${errorMessage}`,
        errorType: "INTERNAL_ERROR"
      },
      { status: 500 }
    );
  }
}
