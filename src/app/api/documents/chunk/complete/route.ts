import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatFileSize } from "@/lib/format";
import {
  embedDocuments,
  isEmbeddingConfigured,
} from "@/lib/embedding";
import { updateChunkEmbedding, ChunkMetadata } from "@/lib/vectorStore";
import {
  DocumentParseError,
  EncryptedPDFError,
  ScannedPDFError,
  CorruptedFileError,
  EmptyContentError,
  getDocumentTypeFromExtension,
  DocumentType,
  detectSQLDialect,
} from "@/lib/documentParser";
import { importSQLFile, SQLImportResult } from "@/lib/sqlParser";
import { parseSQLStream, StreamParseProgress } from "@/lib/streaming/sqlStreamParser";
import {
  processChunksWithErrorHandling,
  processSQLChunksWithErrorHandling,
  splitTextIntoChunks,
  splitSQLIntoChunks,
  ChunkProgressCallback,
  ChunkProcessingResult,
} from "@/lib/documentChunkProcessor";
import { getRAGConfig } from "@/lib/ragConfig";
import {
  setUploadProgressStage,
  updateUploadProgress,
  UploadProgressStage,
} from "@/lib/uploadProgress";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  unlinkSync,
  rmdirSync,
  readFileSync,
} from "fs";
import path from "path";
import { getUploadSession, deleteUploadSession } from "@/lib/uploadSession";

const DOCUMENT_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
  FAILED: "FAILED",
} as const;

type DocumentStatus = typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS];

function createChunkProgressCallback(uploadId: string): ChunkProgressCallback {
  return (progress) => {
    const baseProgress = 80;
    const progressRange = 5;
    
    const calculatedProgress = baseProgress + (progress.progress * progressRange / 100);
    
    updateUploadProgress(uploadId, {
      stage: "storing",
      progress: calculatedProgress,
      message: progress.message,
      processedItems: progress.processedItems,
      totalItems: progress.totalItems,
    });
    
    console.log(`[进度更新] ${progress.message} (${Math.round(calculatedProgress)}%)`);
  };
}

function updateEmbeddingProgress(
  uploadId: string,
  current: number,
  total: number,
  message: string
) {
  const baseProgress = 85;
  const progressRange = 10;
  const progress = baseProgress + (current / total) * progressRange;
  
  updateUploadProgress(uploadId, {
    stage: "embedding",
    progress,
    message,
    processedItems: current,
    totalItems: total,
  });
}

async function mergeChunks(
  uploadId: string,
  totalChunks: number,
  outputPath: string
): Promise<void> {
  const tempDir = path.join(process.cwd(), "uploads", "temp", uploadId);
  const writeStream = createWriteStream(outputPath);

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(tempDir, `chunk_${i}`);
    if (!existsSync(chunkPath)) {
      throw new Error(`缺少文件块: chunk_${i}`);
    }

    const chunkBuffer = readFileSync(chunkPath);
    writeStream.write(chunkBuffer);
  }

  return new Promise<void>((resolve, reject) => {
    writeStream.end((err?: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function cleanupTempFiles(uploadId: string): void {
  const tempDir = path.join(process.cwd(), "uploads", "temp", uploadId);
  if (existsSync(tempDir)) {
    try {
      const files = require("fs").readdirSync(tempDir);
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        unlinkSync(filePath);
      }
      rmdirSync(tempDir);
    } catch (e) {
      console.warn("清理临时文件失败:", e);
    }
  }
}

async function extractTextFromFile(
  filePath: string,
  fileExtension: string
): Promise<string> {
  const docType = getDocumentTypeFromExtension(fileExtension);

  switch (docType) {
    case "txt":
    case "sql":
      return readFileSync(filePath, "utf-8");

    case "pdf": {
      const { pdfParser } = await import("@/lib/documentParser/pdfParser");
      const result = await pdfParser.parse(filePath);
      return result;
    }

    case "docx": {
      const { docxParser } = await import("@/lib/documentParser/docxParser");
      const result = await docxParser.parse(filePath);
      return result;
    }

    default:
      return readFileSync(filePath, "utf-8");
  }
}

export async function POST(request: NextRequest) {
  let uploadId: string | null = null;
  
  try {
    const user = await requireAuth(request);
    const currentUserId = user.id;
    const embeddingConfigured = await isEmbeddingConfigured();

    const body = await request.json();
    const { uploadId: bodyUploadId, title, knowledgeBaseId } = body;
    uploadId = bodyUploadId;

    if (!uploadId) {
      return NextResponse.json(
        { message: "uploadId 不能为空" },
        { status: 400 }
      );
    }

    const session = getUploadSession(uploadId);
    if (!session) {
      return NextResponse.json(
        { message: "上传会话不存在或已过期，请重新开始上传" },
        { status: 404 }
      );
    }

    if (session.userId !== currentUserId) {
      return NextResponse.json(
        { message: "您没有权限操作此上传会话" },
        { status: 403 }
      );
    }

    if (session.uploadedChunks.size !== session.totalChunks) {
      return NextResponse.json(
        {
          message: "文件块未上传完整",
          uploaded: session.uploadedChunks.size,
          total: session.totalChunks,
        },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const uniqueFileName = `${timestamp}-${randomString}${session.fileExtension}`;
    const filePath = path.join(uploadsDir, uniqueFileName);

    await mergeChunks(uploadId, session.totalChunks, filePath);

    setUploadProgressStage(uploadId, "encoding", "正在识别文件编码并转换为 UTF-8");

    if (knowledgeBaseId && knowledgeBaseId.trim()) {
      const kb = await prisma.knowledgeBase.findUnique({
        where: { id: knowledgeBaseId },
        select: { id: true, ownerId: true },
      });

      if (!kb) {
        cleanupTempFiles(uploadId);
        return NextResponse.json(
          { message: "指定的知识库不存在" },
          { status: 400 }
        );
      }

      if (kb.ownerId !== currentUserId) {
        cleanupTempFiles(uploadId);
        return NextResponse.json(
          { message: "您没有权限向此知识库添加文档" },
          { status: 403 }
        );
      }
    }

    let extractedContent = "";
    let parseError: DocumentParseError | null = null;
    let textChunks: string[] = [];
    let docType: DocumentType | null = null;
    let sqlParseProgress: StreamParseProgress | null = null;

    try {
      docType = getDocumentTypeFromExtension(session.fileExtension);
      console.log(
        `开始解析文档: ${session.fileName}, 类型: ${docType}, 大小: ${formatFileSize(session.fileSize)}`
      );

      setUploadProgressStage(uploadId, "parsing", "正在解析文档内容...");

      if (docType === "sql" && session.fileSize > 10 * 1024 * 1024) {
        console.log(`[流式解析] 大SQL文件，使用流式解析: ${session.fileName}`);
        
        updateUploadProgress(uploadId, {
          stage: "parsing",
          progress: 55,
          message: "正在将 SQL 拆分为 DDL 逻辑块...",
        });
        
        const streamResult = await parseSQLStream(filePath, "mysql", (progress) => {
          sqlParseProgress = { ...progress };
          
          const linesProgress = Math.min(progress.linesProcessed / 1000, 1);
          const parsingProgress = 50 + linesProgress * 25;
          
          updateUploadProgress(uploadId!, {
            stage: "parsing",
            progress: parsingProgress,
            message: `正在解析SQL: 行=${progress.linesProcessed}, 表=${progress.tablesFound}`,
            processedItems: progress.linesProcessed,
          });
          
          console.log(
            `[流式解析] 进度: 行=${progress.linesProcessed}, 语句=${progress.statementsFound}, 表=${progress.tablesFound}`
          );
        });

        extractedContent = readFileSync(filePath, "utf-8");
        
        console.log(
          `[流式解析] 完成: 表=${streamResult.tables.length}, 行=${streamResult.progress.linesProcessed}`
        );
      } else {
        extractedContent = await extractTextFromFile(
          filePath,
          session.fileExtension
        );
      }

      updateUploadProgress(uploadId, {
        stage: "parsing",
        progress: 75,
        message: "文档解析完成",
      });

      console.log(
        `文档解析成功，文本长度: ${extractedContent.length} 字符`
      );
    } catch (error) {
      if (error instanceof DocumentParseError) {
        parseError = error;
        console.log("文档解析失败:", error.message);
      } else if (error instanceof Error) {
        parseError = new DocumentParseError(
          `解析失败: ${error.message}`,
          docType ?? undefined
        );
        console.log("文档解析失败:", error.message);
      } else {
        throw error;
      }
    }

    const isSQLFile =
      session.fileExtension.toLowerCase() === ".sql" || docType === "sql";

    if (!parseError) {
      setUploadProgressStage(uploadId, "chunking", "正在创建文本切片...");
      
      const ragConfig = await getRAGConfig();
      
      if (isSQLFile) {
        textChunks = splitSQLIntoChunks(extractedContent);
        console.log(`[RAG 预处理] SQL文档 "${title || session.fileName}" 文本长度: ${extractedContent.length} 字符`);
        console.log(`[RAG 预处理] SQL文档 "${title || session.fileName}" 使用CREATE语句分割，切片数量: ${textChunks.length} 个片段`);
      } else {
        textChunks = splitTextIntoChunks(
          extractedContent,
          ragConfig.chunkSize,
          ragConfig.chunkOverlap
        );
        console.log(`[RAG 预处理] 文档 "${title || session.fileName}" 文本长度: ${extractedContent.length} 字符`);
        console.log(`[RAG 预处理] 文档 "${title || session.fileName}" 切片数量: ${textChunks.length} 个片段 (chunkSize=${ragConfig.chunkSize}, overlap=${ragConfig.chunkOverlap})`);
      }
      
      updateUploadProgress(uploadId, {
        stage: "chunking",
        progress: 78,
        message: `已创建 ${textChunks.length} 个文本片段，准备写入数据库...`,
        totalItems: textChunks.length,
      });

      if (textChunks.length === 0) {
        console.log(
          `[RAG 预处理] 文档 "${title || session.fileName}" 切片数量为0`
        );
        parseError = new EmptyContentError(
          docType?.toUpperCase() || "DOCUMENT"
        );
      }

      if (textChunks.length > 0) {
        console.log(
          `[RAG 预处理] 文档 "${title || session.fileName}" 第一个片段长度: ${textChunks[0].length} 字符`
        );
      }
    }

    if (parseError) {
      console.log(
        `[RAG 预处理] 文档 "${title || session.fileName}" 解析失败，创建 FAILED 状态文档`
      );

      const failedDocument = await prisma.document.create({
        data: {
          title: title || session.fileName.replace(/\.[^/.]+$/, ""),
          content: null,
          fileUrl: `/uploads/${uniqueFileName}`,
          fileType: session.fileExtension.substring(1).toUpperCase(),
          fileSize: BigInt(session.fileSize),
          status: DOCUMENT_STATUS.FAILED,
          authorId: currentUserId,
          knowledgeBaseId: knowledgeBaseId || null,
        },
      });

      cleanupTempFiles(uploadId);
      deleteUploadSession(uploadId);

      return NextResponse.json(
        {
          message: parseError.message,
          errorType: parseError.name,
          document: {
            ...failedDocument,
            fileSize: failedDocument.fileSize?.toString() || null,
          },
        },
        { status: 500 }
      );
    }

    let chunkProcessingResult: {
      storedCount: number;
      skippedCount: number;
      sanitizationErrors: number;
    } | null = null;

    const document = await prisma.$transaction(async (tx) => {
      const newDocument = await tx.document.create({
        data: {
          title: title || session.fileName.replace(/\.[^/.]+$/, ""),
          content: extractedContent || null,
          fileUrl: `/uploads/${uniqueFileName}`,
          fileType: session.fileExtension.substring(1).toUpperCase(),
          fileSize: BigInt(session.fileSize),
          status: DOCUMENT_STATUS.DRAFT,
          authorId: currentUserId,
          knowledgeBaseId: knowledgeBaseId || null,
        },
      });

      return newDocument;
    });

    const chunkProgressCallback = createChunkProgressCallback(uploadId);
    
    if (isSQLFile) {
      chunkProcessingResult = await processSQLChunksWithErrorHandling(
        textChunks,
        document.id,
        chunkProgressCallback
      );
    } else {
      chunkProcessingResult = await processChunksWithErrorHandling(
        textChunks,
        document.id,
        chunkProgressCallback
      );
    }

    console.log(
      `[RAG 存储] 文档 "${title || session.fileName}" 片段处理结果: 存储=${chunkProcessingResult.storedCount}, 跳过=${chunkProcessingResult.skippedCount}, 清洗错误=${chunkProcessingResult.sanitizationErrors}`
    );

    let embeddingSuccess = false;
    let embeddingError: string | null = null;
    let sqlImportResult: SQLImportResult | null = null;

    if (isSQLFile && extractedContent) {
      try {
        console.log(
          `[SQL导入] 检测到SQL文件，开始解析表结构: "${title || session.fileName}"`
        );

        setUploadProgressStage(uploadId, "sqlImporting", "正在导入SQL表结构...");

        const dialect = detectSQLDialect(extractedContent);
        console.log(`[SQL导入] 检测到的SQL方言: ${dialect}`);

        sqlImportResult = await importSQLFile(extractedContent, {
          knowledgeBaseId: knowledgeBaseId || undefined,
          documentId: document.id,
          userId: currentUserId,
          overwriteExisting: false,
          inferRelations: true,
          dialect: dialect,
        });

        updateUploadProgress(uploadId, {
          stage: "sqlImporting",
          progress: 90,
          message: `SQL导入完成: 表=${sqlImportResult.tablesImported}, 字段=${sqlImportResult.columnsImported}`,
        });

        console.log(
          `[SQL导入] 导入完成: 表=${sqlImportResult.tablesImported}, 字段=${sqlImportResult.columnsImported}, 关系=${sqlImportResult.relationsImported}`
        );

        if (sqlImportResult.warnings.length > 0) {
          console.log(
            `[SQL导入] 警告: ${sqlImportResult.warnings.join(", ")}`
          );
        }
        if (sqlImportResult.errors.length > 0) {
          console.log(
            `[SQL导入] 错误: ${sqlImportResult.errors.join(", ")}`
          );
        }
      } catch (error) {
        console.error(`[SQL导入] 导入失败:`, error);
        sqlImportResult = {
          success: false,
          tablesImported: 0,
          columnsImported: 0,
          relationsImported: 0,
          errors: [error instanceof Error ? error.message : "未知错误"],
          warnings: [],
          tableNames: [],
        };
      }
    }

    if (embeddingConfigured && chunkProcessingResult && chunkProcessingResult.storedCount > 0) {
      try {
        console.log(
          `[RAG Embedding] 开始向量化文档 "${title || session.fileName}" 的 ${chunkProcessingResult.storedCount} 个片段`
        );

        setUploadProgressStage(uploadId, "embedding", "正在向量化文本片段...");

        const chunks = await prisma.documentChunk.findMany({
          where: { documentId: document.id },
          orderBy: { index: "asc" },
          select: { id: true, content: true, index: true },
        });

        const docInfo = await prisma.document.findUnique({
          where: { id: document.id },
          select: { knowledgeBaseId: true },
        });

        const validChunks = chunks.filter(c => c.content && c.content.trim().length > 0);
        const contents = validChunks.map(c => c.content || "");
        const totalBatches = Math.ceil(contents.length / 10);

        if (contents.length > 0) {
          const batchSize = 10;
          for (let batch = 0; batch < contents.length; batch += batchSize) {
            const batchContents = contents.slice(batch, batch + batchSize);
            const batchChunks = validChunks.slice(batch, batch + batchSize);
            const currentBatchNum = Math.floor(batch / batchSize) + 1;

            try {
              const embeddingResult = await embedDocuments(batchContents);
              console.log(
                `[RAG Embedding] 批次 ${currentBatchNum}/${totalBatches} 向量化完成，模型: ${embeddingResult.model}`
              );

              updateEmbeddingProgress(
                uploadId,
                currentBatchNum,
                totalBatches,
                `向量化进度: ${currentBatchNum}/${totalBatches} 批次`
              );

              for (let i = 0; i < batchChunks.length && i < embeddingResult.vectors.length; i++) {
                try {
                  const metadata: ChunkMetadata = {
                    documentId: document.id,
                    knowledgeBaseId: docInfo?.knowledgeBaseId || null,
                    content: batchChunks[i].content,
                    index: batchChunks[i].index,
                  };
                  
                  await updateChunkEmbedding(
                    batchChunks[i].id,
                    embeddingResult.vectors[i],
                    embeddingResult.model,
                    metadata
                  );
                } catch (updateError) {
                  console.error(
                    `[RAG Embedding] 片段 ${batchChunks[i].index} 向量存储失败，跳过:`,
                    updateError instanceof Error ? updateError.message : "未知错误"
                  );
                }
              }
            } catch (batchError) {
              console.error(
                `[RAG Embedding] 批次 ${currentBatchNum} 向量化失败，跳过该批次:`,
                batchError instanceof Error ? batchError.message : "未知错误"
              );
            }
          }
        }

        embeddingSuccess = true;
        console.log(
          `[RAG Embedding] 文档 "${title || session.fileName}" 向量化存储完成`
        );
      } catch (error) {
        embeddingError =
          error instanceof Error ? error.message : "未知错误";
        console.error(`[RAG Embedding] 向量化失败:`, error);
      }
    } else {
      if (!embeddingConfigured) {
        console.log(`[RAG Embedding] Embedding 服务未配置，跳过向量化`);
      }
      if (chunkProcessingResult && chunkProcessingResult.storedCount === 0) {
        console.log(`[RAG Embedding] 没有有效片段，跳过向量化`);
      }
    }

    const ragInfo = {
      chunkCount: chunkProcessingResult?.storedCount || 0,
      skippedCount: chunkProcessingResult?.skippedCount || 0,
      sanitizationErrors: chunkProcessingResult?.sanitizationErrors || 0,
      embeddingConfigured: embeddingConfigured,
      embeddingSuccess,
      embeddingError,
    };

    const responseData: any = {
      message: chunkProcessingResult && chunkProcessingResult.skippedCount > 0 
        ? `上传成功（跳过 ${chunkProcessingResult.skippedCount} 个问题片段）`
        : "上传成功",
      document: {
        ...document,
        fileSize: document.fileSize?.toString() || null,
      },
      rag: ragInfo,
      uploadMethod: "chunked",
      totalChunks: session.totalChunks,
    };

    if (sqlParseProgress) {
      responseData.streamParseProgress = sqlParseProgress;
    }

    if (sqlImportResult) {
      responseData.sqlImport = {
        success: sqlImportResult.success,
        tablesImported: sqlImportResult.tablesImported,
        columnsImported: sqlImportResult.columnsImported,
        relationsImported: sqlImportResult.relationsImported,
        errors: sqlImportResult.errors,
        warnings: sqlImportResult.warnings,
        tableNames: sqlImportResult.tableNames,
      };
    }

    setUploadProgressStage(uploadId, "success", "数据已就绪，上传成功！");

    cleanupTempFiles(uploadId);
    deleteUploadSession(uploadId);

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    
    if (uploadId) {
      updateUploadProgress(uploadId, {
        stage: "error",
        progress: 0,
        message: `上传失败: ${errorMessage}`,
        error: errorMessage,
      });
    }

    if (error instanceof DocumentParseError) {
      return NextResponse.json(
        { message: error.message, errorType: error.name },
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
      if (
        error.message === "账号待审核，请联系管理员" ||
        error.message === "账号已被禁用，请联系管理员"
      ) {
        return NextResponse.json(
          { message: error.message },
          { status: 403 }
        );
      }
    }

    console.error("分块上传完成失败:", error);

    return NextResponse.json(
      {
        message: `上传失败: ${errorMessage}`,
        errorType: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
