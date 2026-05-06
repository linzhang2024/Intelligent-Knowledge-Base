import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { formatFileSize } from "@/lib/format";
import { requireAuth } from "@/lib/auth";
import { embedDocuments, isEmbeddingConfigured } from "@/lib/embedding";
import { updateChunkEmbedding, ChunkMetadata } from "@/lib/vectorStore";
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
  detectSQLDialect,
} from "@/lib/documentParser";
import { importSQLFile, SQLImportResult } from "@/lib/sqlParser";
import {
  splitTextIntoChunks,
  splitSQLIntoChunks,
  processChunksWithErrorHandling,
  processSQLChunksWithErrorHandling,
} from "@/lib/documentChunkProcessor";
import { getRAGConfig } from "@/lib/ragConfig";
import { getStorageConfig, getMaxFileSizeBytes } from "@/lib/storageConfig";
import {
  splitSQLFile,
  deleteSplitFiles,
  deleteSplitFile,
  SplitFileInfo,
  SplitResult,
  MAX_CHUNK_SIZE,
  needsSplitting,
  readAndDecodeFile,
  ensureSplitTmpDir,
} from "@/lib/sqlFileSplitter";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/sql",
  "text/sql",
  "application/x-sql",
];
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".sql"];

const DOCUMENT_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
  FAILED: "FAILED",
} as const;

type DocumentStatus = typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS];

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const currentUserId = user.id;
    const embeddingConfigured = await isEmbeddingConfigured();
    const storageConfig = await getStorageConfig();
    const maxFileSizeBytes = getMaxFileSizeBytes(storageConfig.maxFileSizeMB);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const content = formData.get("content") as string | null;
    const knowledgeBaseId = formData.get("knowledgeBaseId") as string | null;

    if (!title) {
      return NextResponse.json(
        { message: "文档标题不能为空" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { message: "请选择要上传的文件" },
        { status: 400 }
      );
    }

    if (file.size > maxFileSizeBytes) {
      return NextResponse.json(
        { message: `文件大小不能超过 ${storageConfig.maxFileSizeMB}MB，当前文件大小为 ${formatFileSize(file.size)}` },
        { status: 400 }
      );
    }

    const fileExtension = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const isMimeTypeAllowed = ALLOWED_TYPES.includes(file.type);
    const isExtensionAllowed = ALLOWED_EXTENSIONS.includes(fileExtension);

    if (!isMimeTypeAllowed && !isExtensionAllowed) {
      return NextResponse.json(
        { 
          message: `不支持的文件格式 "${fileExtension}"，仅支持 PDF、DOCX、TXT、SQL 格式`,
          errorType: "UNSUPPORTED_FORMAT"
        },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const uniqueFileName = `${timestamp}-${randomString}${fileExtension}`;
    const filePath = path.join(uploadsDir, uniqueFileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    if (knowledgeBaseId && knowledgeBaseId.trim()) {
      const kb = await prisma.knowledgeBase.findUnique({
        where: { id: knowledgeBaseId },
        select: { id: true, ownerId: true },
      });

      if (!kb) {
        return NextResponse.json(
          { message: "指定的知识库不存在" },
          { status: 400 }
        );
      }

      if (kb.ownerId !== currentUserId) {
        return NextResponse.json(
          { message: "您没有权限向此知识库添加文档" },
          { status: 403 }
        );
      }
    }

    let extractedContent = content || "";
    let parseError: DocumentParseError | null = null;
    let textChunks: string[] = [];
    let docType: DocumentType | null = null;
    let splitFiles: SplitFileInfo[] = [];
    let needsCleanup = false;

    const isSQLFile = fileExtension.toLowerCase() === ".sql" || docType === "sql";

    try {
      docType = getDocumentTypeFromExtension(fileExtension);
      console.log(`开始解析文档: ${file.name}, 类型: ${docType}`);
      
      if (isSQLFile) {
        console.log(`[SQL处理] 检测到SQL文件，检查是否需要拆分...`);
        
        if (needsSplitting(file.size)) {
          console.log(`[SQL处理] 文件大小 ${formatFileSize(file.size)} 超过阈值，开始拆分...`);
          
          const splitResult = await splitSQLFile(filePath);
          
          if (splitResult.success && splitResult.files.length > 0) {
            splitFiles = splitResult.files;
            needsCleanup = true;
            console.log(`[SQL处理] 文件拆分完成，共 ${splitFiles.length} 个片段`);
            
            const allContents: string[] = [];
            for (const splitFile of splitFiles) {
              console.log(`[SQL处理] 处理片段: ${splitFile.fileName}`);
              const parseResult = await parseDocument(splitFile.filePath, "sql");
              allContents.push(parseResult.text);
            }
            extractedContent = allContents.join("\n\n");
          } else {
            console.log(`[SQL处理] 文件拆分失败或无需拆分，使用原始文件解析`);
            const parseResult = await parseDocument(filePath, docType);
            extractedContent = parseResult.text;
          }
        } else {
          console.log(`[SQL处理] 文件大小 ${formatFileSize(file.size)} 未超过阈值，直接解析`);
          const parseResult = await parseDocument(filePath, docType);
          extractedContent = parseResult.text;
        }
      } else {
        const parseResult = await parseDocument(filePath, docType);
        extractedContent = parseResult.text;
      }
      
      console.log(`文档解析成功，文本长度: ${extractedContent.length} 字符`);
    } catch (error) {
      if (error instanceof DocumentParseError) {
        parseError = error;
        console.log("文档解析失败:", error.message);
      } else {
        throw error;
      }
    }

    let chunkProcessingResult: {
      storedCount: number;
      skippedCount: number;
      sanitizationErrors: number;
    } | null = null;

    if (!parseError) {
      const ragConfig = await getRAGConfig();
      
      if (isSQLFile) {
        textChunks = splitSQLIntoChunks(extractedContent);
        console.log(`[RAG 预处理] SQL文档 "${title}" 文本长度: ${extractedContent.length} 字符`);
        console.log(`[RAG 预处理] SQL文档 "${title}" 使用CREATE语句分割，切片数量: ${textChunks.length} 个片段`);
      } else {
        textChunks = splitTextIntoChunks(
          extractedContent,
          ragConfig.chunkSize,
          ragConfig.chunkOverlap
        );
        console.log(`[RAG 预处理] 文档 "${title}" 文本长度: ${extractedContent.length} 字符`);
        console.log(`[RAG 预处理] 文档 "${title}" 切片数量: ${textChunks.length} 个片段 (chunkSize=${ragConfig.chunkSize}, overlap=${ragConfig.chunkOverlap})`);
      }
      
      if (textChunks.length === 0) {
        console.log(`[RAG 预处理] 文档 "${title}" 切片数量为0`);
        parseError = new EmptyContentError(docType?.toUpperCase() || "DOCUMENT");
      }

      if (textChunks.length > 0) {
        console.log(`[RAG 预处理] 文档 "${title}" 第一个片段长度: ${textChunks[0].length} 字符`);
      }
    }

    if (parseError) {
      console.log(`[RAG 预处理] 文档 "${title}" 解析失败，创建 FAILED 状态文档`);
      
      const failedDocument = await prisma.document.create({
        data: {
          title,
          content: null,
          fileUrl: `/uploads/${uniqueFileName}`,
          fileType: fileExtension.substring(1).toUpperCase(),
          fileSize: BigInt(file.size),
          status: DOCUMENT_STATUS.FAILED,
          authorId: currentUserId,
          knowledgeBaseId: knowledgeBaseId || null,
        },
      });

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

    const document = await prisma.$transaction(async (tx) => {
      const newDocument = await tx.document.create({
        data: {
          title,
          content: extractedContent || null,
          fileUrl: `/uploads/${uniqueFileName}`,
          fileType: fileExtension.substring(1).toUpperCase(),
          fileSize: BigInt(file.size),
          status: DOCUMENT_STATUS.DRAFT,
          authorId: currentUserId,
          knowledgeBaseId: knowledgeBaseId || null,
        },
      });

      return newDocument;
    });

    if (isSQLFile) {
      chunkProcessingResult = await processSQLChunksWithErrorHandling(
        textChunks,
        document.id
      );
    } else {
      chunkProcessingResult = await processChunksWithErrorHandling(
        textChunks,
        document.id
      );
    }

    console.log(
      `[RAG 存储] 文档 "${title}" 片段处理结果: 存储=${chunkProcessingResult.storedCount}, 跳过=${chunkProcessingResult.skippedCount}, 清洗错误=${chunkProcessingResult.sanitizationErrors}`
    );

    let embeddingSuccess = false;
    let embeddingError: string | null = null;
    let sqlImportResult: SQLImportResult | null = null;

    if (isSQLFile && extractedContent) {
      try {
        console.log(`[SQL导入] 检测到SQL文件，开始解析表结构: "${title}"`);
        
        let totalTablesImported = 0;
        let totalColumnsImported = 0;
        let totalRelationsImported = 0;
        let allErrors: string[] = [];
        let allWarnings: string[] = [];
        let allTableNames: string[] = [];

        if (splitFiles.length > 0) {
          console.log(`[SQL导入] 逐个处理拆分后的 ${splitFiles.length} 个文件...`);
          
          for (let i = 0; i < splitFiles.length; i++) {
            const splitFile = splitFiles[i];
            console.log(`[SQL导入] 处理片段 ${i + 1}/${splitFiles.length}: ${splitFile.fileName}`);
            
            try {
              const splitFileContent = (await parseDocument(splitFile.filePath, "sql")).text;
              const dialect = detectSQLDialect(splitFileContent);
              
              const chunkResult = await importSQLFile(splitFileContent, {
                knowledgeBaseId: knowledgeBaseId || undefined,
                documentId: document.id,
                userId: currentUserId,
                overwriteExisting: false,
                inferRelations: true,
                dialect: dialect,
              });
              
              totalTablesImported += chunkResult.tablesImported;
              totalColumnsImported += chunkResult.columnsImported;
              totalRelationsImported += chunkResult.relationsImported;
              allErrors.push(...chunkResult.errors);
              allWarnings.push(...chunkResult.warnings);
              allTableNames.push(...chunkResult.tableNames);
              
              console.log(`[SQL导入] 片段 ${i + 1} 导入完成: 表=${chunkResult.tablesImported}, 字段=${chunkResult.columnsImported}`);
            } catch (chunkError) {
              const errorMsg = `片段 ${splitFile.fileName} 导入失败: ${chunkError instanceof Error ? chunkError.message : "未知错误"}`;
              console.error(`[SQL导入] ${errorMsg}`);
              allErrors.push(errorMsg);
            }
          }
          
          sqlImportResult = {
            success: allErrors.length === 0,
            tablesImported: totalTablesImported,
            columnsImported: totalColumnsImported,
            relationsImported: totalRelationsImported,
            errors: allErrors,
            warnings: allWarnings,
            tableNames: allTableNames,
          };
        } else {
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
        }

        console.log(`[SQL导入] 导入完成: 表=${sqlImportResult.tablesImported}, 字段=${sqlImportResult.columnsImported}, 关系=${sqlImportResult.relationsImported}`);
        
        if (sqlImportResult.warnings.length > 0) {
          console.log(`[SQL导入] 警告: ${sqlImportResult.warnings.join(", ")}`);
        }
        if (sqlImportResult.errors.length > 0) {
          console.log(`[SQL导入] 错误: ${sqlImportResult.errors.join(", ")}`);
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

    if (embeddingConfigured && chunkProcessingResult.storedCount > 0) {
      try {
        console.log(`[RAG Embedding] 开始向量化文档 "${title}" 的 ${chunkProcessingResult.storedCount} 个片段`);
        
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

        if (contents.length > 0) {
          const batchSize = 10;
          for (let batch = 0; batch < contents.length; batch += batchSize) {
            const batchContents = contents.slice(batch, batch + batchSize);
            const batchChunks = validChunks.slice(batch, batch + batchSize);

            try {
              const embeddingResult = await embedDocuments(batchContents);
              console.log(
                `[RAG Embedding] 批次 ${Math.floor(batch / batchSize) + 1}/${Math.ceil(contents.length / batchSize)} 向量化完成，模型: ${embeddingResult.model}`
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
                `[RAG Embedding] 批次 ${Math.floor(batch / batchSize) + 1} 向量化失败，跳过该批次:`,
                batchError instanceof Error ? batchError.message : "未知错误"
              );
            }
          }
        }

        embeddingSuccess = true;
        console.log(`[RAG Embedding] 文档 "${title}" 向量化存储完成`);
      } catch (error) {
        embeddingError = error instanceof Error ? error.message : "未知错误";
        console.error(`[RAG Embedding] 向量化失败:`, error);
      }
    } else {
      if (!embeddingConfigured) {
        console.log(`[RAG Embedding] Embedding 服务未配置，跳过向量化`);
      }
      if (chunkProcessingResult.storedCount === 0) {
        console.log(`[RAG Embedding] 没有有效片段，跳过向量化`);
      }
    }

    const ragInfo = {
      chunkCount: chunkProcessingResult.storedCount,
      skippedCount: chunkProcessingResult.skippedCount,
      sanitizationErrors: chunkProcessingResult.sanitizationErrors,
      embeddingConfigured: embeddingConfigured,
      embeddingSuccess,
      embeddingError,
    };

    const responseData: any = {
      message: chunkProcessingResult.skippedCount > 0 
        ? `上传成功（跳过 ${chunkProcessingResult.skippedCount} 个问题片段）`
        : "上传成功",
      document: {
        ...document,
        fileSize: document.fileSize?.toString() || null,
      },
      rag: ragInfo,
    };

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

    if (needsCleanup && splitFiles.length > 0) {
      try {
        console.log(`[SQL清理] 开始删除临时拆分文件...`);
        const cleanupResult = await deleteSplitFiles(splitFiles);
        console.log(`[SQL清理] 临时文件清理完成: 删除=${cleanupResult.deleted}, 错误=${cleanupResult.errors.length}`);
        
        if (cleanupResult.errors.length > 0) {
          console.warn(`[SQL清理] 部分临时文件删除失败:`, cleanupResult.errors);
        }
      } catch (cleanupError) {
        console.error(`[SQL清理] 删除临时文件失败:`, cleanupError);
      }
    }

    return NextResponse.json(responseData, { status: 201 });
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
      if (error.message === "账号待审核，请联系管理员" || 
          error.message === "账号已被禁用，请联系管理员") {
        return NextResponse.json(
          { message: error.message },
          { status: 403 }
        );
      }
    }
    
    console.error("文件上传失败:", error);
    
    if (needsCleanup && splitFiles.length > 0) {
      try {
        console.log(`[SQL清理] 发生错误，清理临时拆分文件...`);
        await deleteSplitFiles(splitFiles);
        console.log(`[SQL清理] 临时文件清理完成`);
      } catch (cleanupError) {
        console.error(`[SQL清理] 删除临时文件失败:`, cleanupError);
      }
    }
    
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    
    return NextResponse.json(
      { 
        message: `上传失败: ${errorMessage}`,
        errorType: "INTERNAL_ERROR"
      },
      { status: 500 }
    );
  }
}
